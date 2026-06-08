import type { AgentStructuredBlock, MomentsGenerationInput } from "@/types/agent";

export type ChatMessageRole = "user" | "assistant";

/** 对助手生成内容的匹配度反馈 */
export type ContentFeedbackVote = "like" | "dislike";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  /** 用户气泡文案 */
  text?: string;
  /** AI 气泡：卡片前说明 */
  leadText?: string;
  /** AI 气泡：结构化业务卡片 */
  structured?: AgentStructuredBlock;
  /** 助手消息：用户对生成结果的反馈（点赞/点踩） */
  contentFeedback?: ContentFeedbackVote | null;
  /** 用户消息（朋友圈）：请求参数快照 */
  momentsSnapshot?: MomentsGenerationInput;
  /** 对话内嵌：与顶部相同的参数卡片（点击「生成新图文」时插入） */
  momentsInlineEditor?: boolean;
  /** 用户消息（政策）：重新生成时复用问题原文 */
  ragQuery?: string;
  /** 用户消息（政策）：当时上传的凭证文件名 */
  ragAttachmentNote?: string;
}
