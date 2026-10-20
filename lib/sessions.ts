/**
 * 本地会话列表：localStorage 持久化。所有写入均带 `typeof window` 判断，供客户端组件在 effect 中调用，避免 SSR 直接读 storage。
 */
import type { AgentScene, MomentsGenerationInput } from "@/types/agent";
import { stringifyStructuredBlock } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";
import type { ChatSessionRecord, SessionSceneCategory } from "@/types/session";

const STORAGE_KEY = APP_LOCAL_STORAGE_KEYS.chatSessions;

/** 列表/标签等：合并双轨消息做推断 */
export function sessionMessagesCombined(rec: ChatSessionRecord): ChatMessage[] {
  return [...rec.messagesMoments, ...rec.messagesRag];
}

function splitLegacyMessages(messages: ChatMessage[], sceneMode: AgentScene): { mom: ChatMessage[]; rag: ChatMessage[] } {
  const mom: ChatMessage[] = [];
  const rag: ChatMessage[] = [];
  for (const m of messages) {
    if (m.momentsSnapshot || m.momentsInlineEditor) {
      mom.push(m);
      continue;
    }
    if (m.ragQuery != null) {
      rag.push(m);
      continue;
    }
    if (m.role === "assistant" && m.structured?.scene === "moments_marketing") {
      mom.push(m);
      continue;
    }
    if (m.role === "assistant" && m.structured?.scene === "store_rag_query") {
      rag.push(m);
      continue;
    }
    (sceneMode === "store_rag_query" ? rag : mom).push(m);
  }
  return { mom, rag };
}

export function deriveSessionTitleDual(messagesMoments: ChatMessage[], messagesRag: ChatMessage[]): string {
  if (messagesMoments.length && messagesRag.length) {
    return deriveSessionTitle(messagesMoments.length >= messagesRag.length ? messagesMoments : messagesRag);
  }
  return deriveSessionTitle(messagesMoments.length ? messagesMoments : messagesRag);
}

export function deriveSceneTagDual(
  messagesMoments: ChatMessage[],
  messagesRag: ChatMessage[],
  sceneMode: AgentScene,
): string {
  const lastMom = [...messagesMoments].reverse().find((m) => m.role === "assistant");
  const lastRag = [...messagesRag].reverse().find((m) => m.role === "assistant");
  if (messagesRag.length >= messagesMoments.length && lastRag?.structured) {
    return deriveSceneTag(messagesRag, "store_rag_query");
  }
  if (lastMom?.structured) return deriveSceneTag(messagesMoments, "moments_marketing");
  if (lastRag) return deriveSceneTag(messagesRag, "store_rag_query");
  if (lastMom) return deriveSceneTag(messagesMoments, "moments_marketing");
  return sceneMode === "moments_marketing" ? "营销生成" : "活动咨询";
}

export function deriveLastPreviewDual(messagesMoments: ChatMessage[], messagesRag: ChatMessage[]): string {
  const pm = deriveLastPreview(messagesMoments);
  const pr = deriveLastPreview(messagesRag);
  if (!pm.trim()) return pr;
  if (!pr.trim()) return pm;
  return messagesMoments.length >= messagesRag.length ? pm : pr;
}

function isSessionShape(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const modeOk = o.sceneMode === "moments_marketing" || o.sceneMode === "store_rag_query";
  if (!modeOk) return false;
  const dual = Array.isArray(o.messagesMoments) && Array.isArray(o.messagesRag);
  const legacy = Array.isArray(o.messages);
  return dual || legacy;
}

function normalizeSession(x: unknown): ChatSessionRecord | null {
  if (!isSessionShape(x)) return null;
  const o = x as Record<string, unknown>;
  const id = o.id as string;
  const sceneMode = o.sceneMode as AgentScene;
  const momentsForm = o.momentsForm as MomentsGenerationInput | undefined;

  let messagesMoments: ChatMessage[];
  let messagesRag: ChatMessage[];
  if (Array.isArray(o.messagesMoments) && Array.isArray(o.messagesRag)) {
    messagesMoments = o.messagesMoments as ChatMessage[];
    messagesRag = o.messagesRag as ChatMessage[];
  } else {
    const legacy = (o.messages as ChatMessage[]) ?? [];
    const split = splitLegacyMessages(legacy, sceneMode);
    messagesMoments = split.mom;
    messagesRag = split.rag;
  }

  const customerName = typeof o.customerName === "string" ? o.customerName.trim().slice(0, 20) : "";
  return {
    id,
    title: customerName || deriveSessionTitleDual(messagesMoments, messagesRag),
    customerName: customerName || undefined,
    sceneTag: deriveSceneTagDual(messagesMoments, messagesRag, sceneMode),
    lastPreview: deriveLastPreviewDual(messagesMoments, messagesRag),
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : Date.now(),
    messagesMoments,
    messagesRag,
    sceneMode,
    momentsForm,
  };
}

function safeParse(raw: string | null): ChatSessionRecord[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map(normalizeSession).filter((r): r is ChatSessionRecord => r !== null);
  } catch {
    return [];
  }
}

function persist(list: ChatSessionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function listSessions(): ChatSessionRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function getSession(id: string): ChatSessionRecord | null {
  return listSessions().find((s) => s.id === id) ?? null;
}

/** 按 `updatedAt` 排序后最近一条会话 id（与会话中心列表一致） */
export function getMostRecentSessionId(): string | null {
  return listSessions()[0]?.id ?? null;
}

/** 首页「继续上次会话」：优先 localStorage 指针，若会话已删则回退为最近一条 */
export function getLastActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_LOCAL_STORAGE_KEYS.lastActiveSessionId)?.trim();
    if (raw && getSession(raw)) return raw;
  } catch {
    /* ignore */
  }
  return getMostRecentSessionId();
}

/** 进入或在该会话中发消息时调用，便于首页恢复上次对话 */
export function setLastActiveSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LOCAL_STORAGE_KEYS.lastActiveSessionId, sessionId);
  } catch {
    /* ignore */
  }
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  const next = listSessions().filter((s) => s.id !== id);
  persist(next);
  try {
    const cur = window.localStorage.getItem(APP_LOCAL_STORAGE_KEYS.lastActiveSessionId)?.trim();
    if (cur === id) {
      window.localStorage.removeItem(APP_LOCAL_STORAGE_KEYS.lastActiveSessionId);
    }
  } catch {
    /* ignore */
  }
}

export function importSharedSessions(
  shares: Array<{
    id?: string;
    title?: string;
    customerName?: string;
    sceneMode?: AgentScene;
    messages?: Array<{ role?: string; text?: string }>;
  }>,
): void {
  if (typeof window === "undefined" || !Array.isArray(shares)) return;
  for (const share of shares) {
    if (!share?.id) continue;
    const messages = (share.messages || []).filter((item) => item?.text?.trim());
    const customerName = String(share.customerName || "").trim();
    if (!messages.length && !customerName) continue;
    const sceneMode: AgentScene = share.sceneMode === "store_rag_query" ? "store_rag_query" : "moments_marketing";
    const chatMessages: ChatMessage[] = messages.map((item, index) => ({
      id: `${share.id}_${index}`,
      role: item.role === "assistant" ? "assistant" : "user",
      text: item.role === "assistant" ? "" : item.text,
      leadText: item.role === "assistant" ? item.text : undefined,
    }));
    const existing = getSession(share.id);
    const title = customerName || share.title || "";
    if (
      existing &&
      sessionMessagesCombined(existing).length >= chatMessages.length &&
      (existing.customerName || "") === customerName
    ) {
      continue;
    }
    const record = buildSessionRecord(
      share.id,
      sceneMode === "store_rag_query" ? [] : chatMessages,
      sceneMode === "store_rag_query" ? chatMessages : [],
      sceneMode,
    );
    record.customerName = customerName || undefined;
    record.title = title || record.title;
    upsertSession(record);
  }
}

export async function pullSharedSessions(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch("/api/guide/store");
    if (!response.ok) return;
    const payload = (await response.json()) as { shares?: Parameters<typeof importSharedSessions>[0] };
    importSharedSessions(payload.shares || []);
  } catch {
    /* 共享会话暂时读不到时，本地列表保持原样 */
  }
}

export function upsertSession(record: ChatSessionRecord): void {
  if (typeof window === "undefined") return;
  const list = listSessions().filter((s) => s.id !== record.id);
  list.unshift({ ...record, updatedAt: Date.now() });
  persist(list.slice(0, 80));
}

export function sessionTitleFor(id: string, messagesMoments: ChatMessage[], messagesRag: ChatMessage[]): string {
  return getSession(id)?.customerName?.trim() || deriveSessionTitleDual(messagesMoments, messagesRag);
}

export function renameSessionCustomer(id: string, name: string): ChatSessionRecord | null {
  const current = getSession(id);
  if (!current) return null;
  const customerName = name.trim().replace(/\s+/g, " ").slice(0, 20);
  const next: ChatSessionRecord = {
    ...current,
    customerName: customerName || undefined,
    title: customerName || deriveSessionTitleDual(current.messagesMoments, current.messagesRag),
  };
  upsertSession(next);
  return getSession(id);
}

export function deriveSessionTitle(messages: ChatMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = m.text?.trim();
    if (text) {
      const line = text.split("\n")[0]?.trim() ?? "新会话";
      return line.length > 28 ? `${line.slice(0, 28)}…` : line;
    }
    const pn = m.momentsSnapshot?.productName?.trim();
    if (pn) {
      return pn.length > 28 ? `${pn.slice(0, 28)}…` : pn;
    }
  }
  return "新会话";
}

/**
 * 会话中心列表四类标签：结合场景与用户措辞推断（无独立「产品」入口时偏启发式）。
 */
export function deriveSessionCategoryLabel(
  messages: ChatMessage[],
  sceneMode: AgentScene,
): SessionSceneCategory {
  const userBlob = messages
    .filter((m) => m.role === "user")
    .map((m) => [m.text ?? "", m.ragQuery ?? "", m.momentsSnapshot?.productName ?? ""].join(" "))
    .join("\n");
  if (/对比|VS|vs|哪个好|还是|区别/i.test(userBlob)) return "对比";
  if (/产品|参数|材质|型号|尺寸|床垫|沙发|哪款|多少钱/i.test(userBlob)) return "产品";
  if (sceneMode === "store_rag_query") return "活动";
  return "文案";
}

export function deriveSceneTag(messages: ChatMessage[], sceneMode: AgentScene): string {
  const lastA = [...messages].reverse().find((m) => m.role === "assistant");
  const st = lastA?.structured;
  if (st?.scene === "moments_marketing") {
    const k = st.outputKind;
    if (k === "copy_only") return "文案生成";
    if (k === "image_only") return "配图生成";
    return "营销图文";
  }
  if (st?.scene === "store_rag_query") return "活动咨询";
  return sceneMode === "moments_marketing" ? "营销生成" : "活动咨询";
}

export function deriveLastPreview(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  if (last.role === "assistant") {
    if (last.structured) {
      const t = stringifyStructuredBlock(last.structured);
      return t.length > 72 ? `${t.slice(0, 72)}…` : t;
    }
    if (last.leadText) return last.leadText.length > 72 ? `${last.leadText.slice(0, 72)}…` : last.leadText;
  }
  const t = last.text ?? "";
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

export function buildSessionRecord(
  id: string,
  messagesMoments: ChatMessage[],
  messagesRag: ChatMessage[],
  sceneMode: AgentScene,
  momentsForm?: MomentsGenerationInput,
): ChatSessionRecord {
  const customerName = getSession(id)?.customerName?.trim() || "";
  return {
    id,
    title: customerName || deriveSessionTitleDual(messagesMoments, messagesRag),
    customerName: customerName || undefined,
    sceneTag: deriveSceneTagDual(messagesMoments, messagesRag, sceneMode),
    lastPreview: deriveLastPreviewDual(messagesMoments, messagesRag),
    updatedAt: Date.now(),
    messagesMoments,
    messagesRag,
    sceneMode,
    momentsForm,
  };
}
