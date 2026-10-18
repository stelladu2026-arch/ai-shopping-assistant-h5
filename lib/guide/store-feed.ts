import { listSessionRecords } from "./db";
import { formatRelativeTime } from "../formatRelativeTime";
import catalog from "../../data/catalog.json";
import type { FollowUpStatus, ReviewSuggestion, RiskDomain, StoreDashboardMetrics, StoreSessionSummaryItem } from "@/types/store-insights";

type ShareMessage = { role: "user" | "assistant"; text: string };

export type SharedSession = {
  id: string;
  updatedAt: number;
  title: string;
  customerName: string;
  sceneMode: "moments_marketing" | "store_rag_query";
  messages: ShareMessage[];
};

function textOf(message: { text?: string; leadText?: string } | null | undefined) {
  return String(message?.text || message?.leadText || "").trim();
}

function messagesOf(record: Record<string, any>): ShareMessage[] {
  const direct = (record.messages || [])
    .map((item: { role?: string; text?: string }): ShareMessage => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: textOf(item),
    }))
    .filter((item: ShareMessage) => item.text);
  if (direct.length) return direct;
  const transcript = record.transcript || {};
  return [...(transcript.messagesMoments || []), ...(transcript.messagesRag || [])]
    .map((item: { role?: string; text?: string; leadText?: string }): ShareMessage => ({
      role: item.role === "assistant" ? "assistant" : "user",
      text: textOf(item),
    }))
    .filter((item) => item.text);
}

function titleOf(record: Record<string, any>, messages: ShareMessage[]) {
  const customerName = String(record.customerName || "").trim();
  if (customerName) return customerName.slice(0, 20);
  const transcriptTitle = String(record.transcript?.title || "").trim();
  if (transcriptTitle) return transcriptTitle.slice(0, 28);
  const first = messages.find((item) => item.role === "user")?.text || "";
  if (!first) return "新会话";
  return first.length > 28 ? `${first.slice(0, 28)}…` : first;
}

function productName(id: string) {
  return catalog.find((item) => item.id === id)?.name || "";
}

function summarize(id: string, record: Record<string, any>, updatedAt: number): StoreSessionSummaryItem | null {
  const messages = messagesOf(record);
  const customerName = String(record.customerName || "").trim();
  if (!messages.length && !customerName && !(record.state?.revision > 0)) return null;
  const blob = messages.map((item) => item.text).join("\n");
  const activity = /活动|满减|叠加|优惠/.test(blob);
  const riskDomain: RiskDomain = activity ? "活动" : "参数";
  const reviewSuggestion: ReviewSuggestion = activity
    ? "建议二次核对（活动）"
    : /质保|保修|售后|材质|尺寸|价格|预算/.test(blob)
      ? "建议二次核对（参数）"
      : "无";
  const confirmed = productName(record.state?.confirmed_product_id);
  const constraints = record.state?.constraints || {};
  const bullets = [
    constraints.category ? `品类 ${constraints.category}` : "",
    constraints.budget_max_cny != null ? `预算 ${constraints.budget_max_cny} 元` : "",
    confirmed ? `已确认 ${confirmed}` : "",
    messages.find((item) => item.role === "user")?.text || "",
  ].filter(Boolean);
  const lastReply = [...messages].reverse().find((item) => item.role === "assistant")?.text || "";
  const followUpStatus: FollowUpStatus = "待辅导";
  return {
    id,
    guideName: "导购",
    subject: titleOf(record, messages),
    riskDomain,
    reviewSuggestion,
    bullets: bullets.slice(0, 3),
    conclusion: lastReply || "会话进行中。",
    followUpStatus,
    relativeTime: formatRelativeTime(updatedAt || record.updatedAt || Date.now()),
  };
}

function shareOf(id: string, record: Record<string, any>, updatedAt: number): SharedSession | null {
  const messages = messagesOf(record);
  const customerName = String(record.customerName || "").trim();
  if (!messages.length && !customerName) return null;
  const sceneMode = record.transcript?.sceneMode === "store_rag_query" ? "store_rag_query" : "moments_marketing";
  return {
    id,
    updatedAt: updatedAt || record.updatedAt || Date.now(),
    title: titleOf(record, messages),
    customerName,
    sceneMode,
    messages,
  };
}

export function storeFeed() {
  const rows = listSessionRecords() as Array<{ id: string; record: Record<string, any>; updatedAt: number }>;
  const summaries = rows
    .map((row) => summarize(row.id, row.record, row.updatedAt))
    .filter((item): item is StoreSessionSummaryItem => Boolean(item));
  const shares = rows
    .map((row) => shareOf(row.id, row.record, row.updatedAt))
    .filter((item): item is SharedSession => Boolean(item));
  const weekAgo = Date.now() - 7 * 86400_000;
  const recent = rows.filter((row) => (row.updatedAt || 0) >= weekAgo);
  const withCopy = recent.filter((row) => row.record?.state?.card || /话术|文案/.test(messagesOf(row.record).map((item) => item.text).join("\n"))).length;
  const product = recent.filter((row) => row.record?.state?.constraints?.category || row.record?.state?.confirmed_product_id).length;
  const campaign = recent.filter((row) => /活动|满减|叠加/.test(messagesOf(row.record).map((item) => item.text).join("\n"))).length;
  const total = recent.length || 1;
  const metrics: StoreDashboardMetrics = {
    activeGuides: recent.length ? 1 : 0,
    weeklySessionCount: recent.length,
    intentShare: {
      product: recent.length ? product / total : 0,
      campaign: recent.length ? campaign / total : 0,
      copy: recent.length ? Math.max(0, 1 - product / total - campaign / total) : 0,
    },
    copyRate: recent.length ? withCopy / recent.length : 0,
    regenerateRate: 0,
  };
  return { summaries, shares, metrics };
}
