import type { AgentScene, AgentStructuredBlock, MomentsGenerationInput } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";

/** 会话中心列表展示用四类标签（导购 demo） */
export type SessionSceneCategory = "产品" | "活动" | "文案" | "对比";

/** 本地会话快照（可同步到服务端） */
export interface ChatSessionRecord {
  id: string;
  title: string;
  /** 展示用场景标签 */
  sceneTag: string;
  lastPreview: string;
  updatedAt: number;
  /** 朋友圈生成场景消息（与政策查询互不混用） */
  messagesMoments: ChatMessage[];
  /** 政策查询场景消息 */
  messagesRag: ChatMessage[];
  /** 最近停留的 Tab，用于恢复 */
  sceneMode: AgentScene;
  /** 朋友圈表单缓存，便于恢复 */
  momentsForm?: MomentsGenerationInput;
}

/** 收藏粒度：单条 AI 消息内容 */
export type FavoriteContentType = "moments_card" | "rag_card" | "text_reply";

export interface FavoriteRecord {
  id: string;
  /** 原对话消息 id，用于去重与星标状态 */
  sourceMessageId: string;
  sessionId: string;
  sessionTitle: string;
  type: FavoriteContentType;
  title: string;
  contentPlain: string;
  structured?: AgentStructuredBlock;
  createdAt: number;
}
