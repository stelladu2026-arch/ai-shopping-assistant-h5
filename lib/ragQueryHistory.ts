import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";

const STORAGE_KEY = APP_LOCAL_STORAGE_KEYS.ragQueryHistory;
const MAX_ITEMS = 20;
const MAX_QUERY_LEN = 200;

function normalizeQuery(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > MAX_QUERY_LEN ? t.slice(0, MAX_QUERY_LEN) : t;
}

export function loadRagQueryHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").map(normalizeQuery).filter(Boolean);
  } catch {
    return [];
  }
}

function persist(list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}

/** 去重并把最新一条置顶，返回新列表 */
export function appendRagQueryHistory(query: string): string[] {
  if (typeof window === "undefined") return [];
  const q = normalizeQuery(query);
  if (!q) return loadRagQueryHistory();
  const prev = loadRagQueryHistory().filter((x) => x !== q);
  const next = [q, ...prev].slice(0, MAX_ITEMS);
  persist(next);
  return next;
}

export function removeRagQueryHistoryItem(query: string): string[] {
  if (typeof window === "undefined") return [];
  const q = normalizeQuery(query);
  const next = loadRagQueryHistory().filter((x) => x !== q);
  persist(next);
  return next;
}

export function clearRagQueryHistory(): string[] {
  if (typeof window === "undefined") return [];
  persist([]);
  return [];
}
