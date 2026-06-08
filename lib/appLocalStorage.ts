/** 应用持久化到 localStorage 的键（会话 / 收藏 / RAG 历史） */
export const APP_LOCAL_STORAGE_KEYS = {
  favorites: "ai-shopping-assistant.favorites.v1",
  chatSessions: "ai-shopping-assistant.chatSessions.v1",
  ragQueryHistory: "ai-shopping-assistant.ragQueryHistory.v1",
  /** 用户上次停留的对话，供首页「继续上次会话」优先读取 */
  lastActiveSessionId: "ai-shopping-assistant.lastActiveSessionId.v1",
  /** 角色、演示门店（导购 / 店长 MVP） */
  appUserSettings: "ai-shopping-assistant.appUserSettings.v1",
  /** 账号登录会话（不含密码） */
  authSession: "ai-shopping-assistant.authSession.v1",
  /** 店长：会话摘要跟进状态覆盖（按摘要 id） */
  managerSummaryFollowUp: "ai-shopping-assistant.managerSummaryFollowUp.v1",
  /** 店长：沉淀为模板的话术记录 */
  managerTemplates: "ai-shopping-assistant.managerTemplates.v1",
  /** 演示：下次对话请求模拟失败（一次性），由设置页开启 */
  demoSimulateChatFailOnce: "ai-shopping-assistant.demoSimulateChatFailOnce.v1",
} as const;

/** 清空上述全部条目，便于本地测试从零开始 */
export function clearAllAppLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(APP_LOCAL_STORAGE_KEYS)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* quota / private mode */
    }
  }
}
