/** 本店会话摘要：风险域（两类标签） */
export type RiskDomain = "参数" | "活动";

/**
 * 复核提示（全站统一口径）
 * - 无
 * - 建议二次核对（参数）
 * - 建议二次核对（活动）
 */
export type ReviewSuggestion = "无" | "建议二次核对（参数）" | "建议二次核对（活动）";

export type FollowUpStatus = "已处理" | "待补充知识点" | "待辅导" | "已沉淀模板";

export interface StoreSessionSummaryItem {
  id: string;
  guideName: string;
  subject: string;
  riskDomain: RiskDomain;
  reviewSuggestion: ReviewSuggestion;
  bullets: string[];
  conclusion: string;
  /** 默认来自 mock，可被 localStorage 覆盖 */
  followUpStatus: FollowUpStatus;
  /** 相对时间展示用 */
  relativeTime: string;
}

export interface StoreDashboardMetrics {
  activeGuides: number;
  weeklySessionCount: number;
  intentShare: { product: number; campaign: number; copy: number };
  copyRate: number;
  regenerateRate: number;
}

export interface ManagerTemplateRecord {
  id: string;
  title: string;
  subject: string;
  guideName: string;
  excerpt: string;
  sourceSummaryId: string;
  createdAt: number;
}

export type SessionCenterScope = "mine" | "store";
