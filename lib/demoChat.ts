import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";

/** 若已标记，返回 true 并清除标记（用于演示一次性失败） */
export function consumeDemoChatFailureFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = APP_LOCAL_STORAGE_KEYS.demoSimulateChatFailOnce;
    const v = window.localStorage.getItem(key);
    if (v === "1") {
      window.localStorage.removeItem(key);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function armDemoChatFailureFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LOCAL_STORAGE_KEYS.demoSimulateChatFailOnce, "1");
  } catch {
    /* ignore */
  }
}
