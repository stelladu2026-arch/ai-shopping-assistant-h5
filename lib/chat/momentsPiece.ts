import type { MomentsGenerationInput } from "@/types/agent";

const GENERATION_PLACEHOLDERS = new Set(["请求失败，请稍后重试。", "重新生成中…"]);

export const BLANK_COPY_STATUS = "待选择";

type PieceMessage = {
  id?: string;
  role?: string;
  leadText?: string;
  structured?: { scene?: string } | null;
};

type CopyReview = {
  material?: {
    bodyTitle?: string;
    bodyText?: string;
    pendingReview?: boolean;
    reviewNote?: string;
    generatedImageUrl?: string;
  } | null;
  image?: { label?: string; called?: boolean; url?: string } | null;
};

export function isGeneratedMomentsPiece(message: PieceMessage | null | undefined): boolean {
  if (!message || message.role !== "assistant") return false;
  if (message.structured?.scene === "moments_marketing") return true;
  return GENERATION_PLACEHOLDERS.has(String(message.leadText || ""));
}

export function appendMomentsPiece<T extends { id?: string }>(messages: T[], piece: T): T[] {
  const list = Array.isArray(messages) ? messages.slice() : [];
  let id = String(piece?.id || "");
  if (!id || list.some((item) => item?.id === id)) {
    id = `piece_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return [...list, { ...piece, id }];
}

/** 点「生成新图文」后只留一张空白待选择卡。不保留上一套标题、正文、配图、报错或待核对。 */
export function resetToBlankCopyCard<T extends PieceMessage>(
  messages: T[] | null | undefined,
  snapshot: MomentsGenerationInput,
  id: string,
): T[] {
  const discarded = Array.isArray(messages) ? messages.length : 0;
  const nextSnapshot: MomentsGenerationInput = {
    outputKind: snapshot?.outputKind || "rich",
    imageCount: snapshot?.imageCount === 1 ? 1 : 4,
    productName: snapshot?.productName || "",
    sellingPoints: [...(snapshot?.sellingPoints ?? [])],
    copyStyle: snapshot?.copyStyle || "warm",
    audience: snapshot?.audience || "first_home",
  };
  const card = {
    id: id || `choice_${discarded.toString(36)}`,
    role: "user" as const,
    text: "",
    leadText: "",
    structured: undefined,
    momentsInlineEditor: true,
    momentsChoice: "pending" as const,
    momentsSnapshot: nextSnapshot,
  };
  return [card as unknown as T];
}

/** 待选择期间不继续展示上一套文案、配图和待核对说明。 */
export function clearCopyReview<T extends CopyReview>(turn: T | null | undefined): T | null {
  if (!turn) return turn ?? null;
  if (!turn.material && !turn.image?.url && !turn.image?.label) return turn;
  return {
    ...turn,
    material: null,
    image: turn.image ? { ...turn.image, label: "", called: false, url: "" } : turn.image,
  };
}
