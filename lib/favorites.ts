/**
 * 收藏列表：localStorage 持久化。读写在客户端执行，SSR 下均返回空数组或 no-op。
 */
import { stringifyStructuredBlock } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";
import type { FavoriteContentType, FavoriteRecord } from "@/types/session";

const STORAGE_KEY = APP_LOCAL_STORAGE_KEYS.favorites;

function safeParse(raw: string | null): FavoriteRecord[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(isFavorite);
  } catch {
    return [];
  }
}

function isFavorite(x: unknown): x is FavoriteRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.sourceMessageId === "string" &&
    typeof o.sessionId === "string" &&
    typeof o.sessionTitle === "string" &&
    typeof o.type === "string" &&
    typeof o.title === "string" &&
    typeof o.contentPlain === "string" &&
    typeof o.createdAt === "number"
  );
}

function persist(list: FavoriteRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function listFavorites(): FavoriteRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export function getFavoriteByMessageId(messageId: string): FavoriteRecord | null {
  return listFavorites().find((f) => f.sourceMessageId === messageId) ?? null;
}

export function isFavorited(messageId: string): boolean {
  return Boolean(getFavoriteByMessageId(messageId));
}

export function removeFavoriteByMessageId(messageId: string): void {
  if (typeof window === "undefined") return;
  const next = listFavorites().filter((f) => f.sourceMessageId !== messageId);
  persist(next);
  void fetch("/api/guide/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unfavorite", sourceMessageId: messageId, id: messageId }),
  });
}

export function removeFavoriteById(id: string): void {
  if (typeof window === "undefined") return;
  const next = listFavorites().filter((f) => f.id !== id);
  persist(next);
}

function inferType(msg: ChatMessage): FavoriteContentType | null {
  if (msg.leadText === "重新生成中…") return null;
  if (msg.structured?.scene === "moments_marketing") return "material";
  if (msg.structured?.scene === "guide_turn" && msg.structured.confirmedName) return "product";
  return null;
}

/** 是否可对助手消息收藏（用于 UI 星标展示） */
export function canFavoriteMessage(msg: ChatMessage): boolean {
  if (msg.role !== "assistant") return false;
  return inferType(msg) !== null;
}

function buildTitle(msg: ChatMessage): string {
  if (msg.structured?.scene === "moments_marketing") {
    return msg.structured.bodyTitle || "素材";
  }
  if (msg.structured?.scene === "guide_turn" && msg.structured.confirmedName) {
    return msg.structured.confirmedName;
  }
  return "收藏";
}

function buildContentPlain(msg: ChatMessage): string {
  const parts: string[] = [];
  if (msg.leadText?.trim()) parts.push(msg.leadText.trim());
  if (msg.structured) parts.push(stringifyStructuredBlock(msg.structured));
  return parts.join("\n\n").trim() || "（无文本）";
}

export function addFavoriteFromMessage(params: {
  sessionId: string;
  sessionTitle: string;
  message: ChatMessage;
}): FavoriteRecord | null {
  if (params.message.role !== "assistant") return null;
  const type = inferType(params.message);
  if (!type) return null;
  if (typeof window === "undefined") return null;

  const existing = getFavoriteByMessageId(params.message.id);
  if (existing) return existing;

  const rec: FavoriteRecord = {
    id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceMessageId: params.message.id,
    sessionId: params.sessionId,
    sessionTitle: params.sessionTitle,
    type,
    title: buildTitle(params.message),
    contentPlain: buildContentPlain(params.message),
    structured: params.message.structured,
    createdAt: Date.now(),
  };
  const list = listFavorites().filter((f) => f.sourceMessageId !== rec.sourceMessageId);
  list.unshift(rec);
  persist(list.slice(0, 200));
  void fetch("/api/guide/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "favorite",
      id: rec.id,
      sourceMessageId: rec.sourceMessageId,
      sessionId: rec.sessionId,
      kind: rec.type === "product" ? "product" : "material",
      title: rec.title,
      contentPlain: rec.contentPlain,
    }),
  });
  return rec;
}

export function mergeServerFavorites(rows: Array<Partial<FavoriteRecord>>): void {
  if (typeof window === "undefined" || !Array.isArray(rows)) return;
  const local = listFavorites();
  let changed = false;
  for (const row of rows) {
    if (!row?.id || !row.title) continue;
    if (row.type !== "product" && row.type !== "material" && row.type !== "moments_card") continue;
    if (local.some((item) => item.id === row.id || (row.sourceMessageId && item.sourceMessageId === row.sourceMessageId))) continue;
    local.push({
      id: row.id,
      sourceMessageId: row.sourceMessageId || row.id,
      sessionId: row.sessionId || "",
      sessionTitle: row.sessionTitle || "这次接待",
      type: row.type,
      title: row.title,
      contentPlain: row.contentPlain || "",
      createdAt: row.createdAt || Date.now(),
    });
    changed = true;
  }
  if (changed) persist(local.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200));
}

export function toggleFavorite(params: {
  sessionId: string;
  sessionTitle: string;
  message: ChatMessage;
}): "added" | "removed" | "noop" {
  if (params.message.role !== "assistant") return "noop";
  if (!inferType(params.message)) return "noop";
  if (isFavorited(params.message.id)) {
    removeFavoriteByMessageId(params.message.id);
    return "removed";
  }
  addFavoriteFromMessage(params);
  return "added";
}
