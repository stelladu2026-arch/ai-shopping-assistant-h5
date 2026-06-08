/**
 * Coze / Agent 对话接口约定（预留）。
 *
 * 场景一 moments_marketing：AIGC 朋友圈营销 — 表单配置 + 成品式输出
 * 场景二 store_rag_query：RAG 政策/商品检索 — 自然语言 + 结构化百科卡
 */

export type AgentScene = "moments_marketing" | "store_rag_query";

/** 与首页「营销生成」子能力一致 */
export type MomentsOutputKind = "copy_only" | "image_only" | "rich";

export type MomentsCopyStyleId = "urgent" | "warm" | "pro" | "redbook";
export type MomentsAudienceId = "first_home" | "upgrade" | "luxury";

/** 场景一：导购侧输入（用于 Prompt / 工作流） */
export interface MomentsGenerationInput {
  /** 与首页一致：仅文案 / 仅配图 / 图文 */
  outputKind: MomentsOutputKind;
  productName: string;
  sellingPoints: string[];
  copyStyle: MomentsCopyStyleId;
  audience: MomentsAudienceId;
}

/** 场景一：模型输出 */
export interface MomentsGenerationResult {
  scene: "moments_marketing";
  outputKind: MomentsOutputKind;
  cardTitle: string;
  bodyTitle?: string;
  bodyText?: string;
  hashtags: string[];
  /** 配图说明或拍摄指引；仅文案时可为空 */
  imageSuggestion?: string;
  /** Coze 绘画插件返回的图片 URL，Mock 阶段可空 */
  generatedImageUrl?: string;
  commentThreadScript?: string;
}

export interface RagRelatedProductItem {
  id: string;
  name: string;
  /** 无图占位展示用 */
  shortLabel: string;
}

/** 场景二：RAG 结构化输出 */
export interface RagPolicyAnswer {
  scene: "store_rag_query";
  policyTitle: string;
  priceHighlights: { label: string; value: string }[];
  conditions: string[];
  activityDeadline: string;
  suggestedScript: string;
  relatedProducts: RagRelatedProductItem[];
}

export type AgentStructuredBlock = MomentsGenerationResult | RagPolicyAnswer;

export interface AgentChatMessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentChatRequestBody {
  scene: AgentScene;
  messages: AgentChatMessagePayload[];
  sessionId?: string;
  /** 场景一：随请求提交的配置 */
  momentsInput?: MomentsGenerationInput;
  /** 场景二：多模态占位说明（如已选图片文件名） */
  attachmentNote?: string;
}

export interface AgentChatResponseBody {
  messageId: string;
  done: boolean;
  leadText?: string;
  structured?: AgentStructuredBlock;
}

export function stringifyStructuredBlock(s: AgentStructuredBlock): string {
  if (s.scene === "moments_marketing") {
    const lines = [
      "【场景】朋友圈营销（AIGC）",
      `类型：${s.outputKind === "copy_only" ? "仅文案" : s.outputKind === "image_only" ? "仅配图" : "图文"}`,
    ];
    if (s.bodyTitle) lines.push(`标题：${s.bodyTitle}`);
    if (s.bodyText) lines.push(`正文：${s.bodyText}`);
    if (s.hashtags.length)
      lines.push(`话题：${s.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`);
    if (s.imageSuggestion?.trim()) lines.push(`配图建议：${s.imageSuggestion}`);
    if (s.generatedImageUrl) lines.push(`配图地址：${s.generatedImageUrl}`);
    if (s.commentThreadScript?.trim()) lines.push(`评论区话术：${s.commentThreadScript}`);
    return lines.join("\n");
  }
  return [
    "【场景】门店政策（RAG）",
    `政策/商品：${s.policyTitle}`,
    `价格要点：${s.priceHighlights.map((p) => `${p.label}${p.value}`).join("；")}`,
    `适用条件：${s.conditions.join("、")}`,
    `活动时间：${s.activityDeadline}`,
    `话术指引：${s.suggestedScript}`,
    `关联商品：${s.relatedProducts.map((p) => p.name).join("、")}`,
  ].join("\n");
}
