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
  /** 没有配图时，配图区域显示的原因。有图时为空。 */
  imagePlaceholder?: string;
  /** 这一套图文自己的编号。重新生成只改这一套。 */
  pieceId?: string;
  /** 图片地址，或 data:image 形式的返回图 */
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

export interface GuideTurnBlock {
  scene: "guide_turn";
  customerId: string;
  customerName: string;
  revision: number;
  constraints?: {
    budget_max_cny: number | null;
    width_max_cm: number | null;
    category: string | null;
    color: string | null;
    exclude_material: string | null;
    style?: string | null;
  };
  constraintTags?: {
    field: string;
    value: string | number;
    label: string;
    strength: "hard" | "prefer";
    locked: boolean;
  }[];
  probe?: {
    needsConfirm?: boolean;
    field?: string;
    label: string;
    ids: string[];
    count: number;
    options?: { field: string; label: string; count: number }[];
  } | null;
  basis?: string;
  mode: "simulation" | "live";
  products: {
    id: string;
    name: string;
    model: string;
    category: string;
    price_cny: number;
    color?: string;
    width_cm?: number;
    material?: string;
    style?: string;
    image?: string;
    promoUse?: string;
    detailNote?: string;
    reason: string;
    failed: boolean;
  }[];
  confirmedName: string | null;
  confirmedId?: string | null;
  confirmedFacts?: {
    id: string;
    name: string;
    model: string;
    price_cny: number;
    width_cm: number;
    color: string;
    material: string;
    style?: string;
    promoNote: string;
  } | null;
  catalog?: {
    id: string;
    name: string;
    model: string;
    category: string;
    price_cny: number;
    width_cm: number;
    color: string;
    material: string;
    style: string;
    image: string;
    promoNote: string;
  }[];
  offerSwitch?: boolean;
  pendingQuestion?: string | null;
  material?: {
    bodyTitle: string;
    bodyText: string;
    pendingReview: boolean;
    reviewNote: string;
    generatedImageUrl: string;
  } | null;
  copyText: string | null;
  copySimulation: boolean;
  promotions: { id: string; discount_cny: number; stack_with?: string[] }[];
  promoPlan?: {
    note: string;
    use: { id: string; discount_cny: number }[];
    excluded: { id: string; reason: string }[];
  } | null;
  image: { label: string; called: boolean; url?: string } | null;
  reflection: {
    pending_review: boolean;
    note: string;
    checks: { name: string; ok: boolean; detail: string }[];
  };
  process?: {
    workflow: { step: string; why: string; status: string };
    rag: { hit: boolean; title: string; excerpt: string; method?: string; fallback?: string };
    agent: { did: string; cannot: string };
    usage?: {
      retrieve: { used: number; limit: number };
      product_decision: { used: number; limit: number };
      content: { used: number; limit: number };
      image: { used: number; limit: number };
    };
    clarify?: { doubt: string; rounds: number; limit: number; capped: boolean }[];
    failure?: { kind: string; text: string } | null;
    degraded?: string[];
  } | null;
  memories: { customer: { id: string; key: string; value: string; verified: boolean }[] };
  guideTone: string | null;
}

export type AgentStructuredBlock = MomentsGenerationResult | RagPolicyAnswer | GuideTurnBlock;

export interface AgentChatMessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentChatRequestBody {
  scene: AgentScene;
  messages: AgentChatMessagePayload[];
  sessionId?: string;
  customerId?: string;
  /** 场景一：随请求提交的配置 */
  momentsInput?: MomentsGenerationInput;
  /** 生成新图文：这一下是新的一套的第 1 次，不沿用上一套的次数 */
  newPiece?: boolean;
  /** 重新生成时指明是哪一套。生成新图文不带这个字段。 */
  pieceId?: string;
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
  if (s.scene === "guide_turn") {
    return [s.customerName, s.copyText || "", s.reflection?.note || ""].filter(Boolean).join("\n");
  }
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
    if (s.generatedImageUrl && !s.generatedImageUrl.startsWith("data:")) lines.push(`配图地址：${s.generatedImageUrl}`);
    else if (!s.generatedImageUrl && s.imagePlaceholder?.trim()) lines.push(`配图：${s.imagePlaceholder}`);
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
