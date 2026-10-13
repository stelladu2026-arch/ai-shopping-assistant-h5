"use client";

import { GenerationFeedbackBar } from "@/components/chat/GenerationFeedbackBar";
import { GuideTurnCard } from "@/components/chat/guide/GuideTurnCard";
import { MomentsResultCard } from "@/components/chat/moments/MomentsResultCard";
import { RagAnswerCard } from "@/components/chat/rag/RagAnswerCard";
import type { AgentStructuredBlock } from "@/types/agent";
import type { ContentFeedbackVote } from "@/types/chat";

interface AssistantBubbleProps {
  favorited?: boolean;
  showFavorite?: boolean;
  onToggleFavorite?: () => void;
  leadText?: string;
  structured?: AgentStructuredBlock;
  contentFeedback?: ContentFeedbackVote | null;
  onContentFeedback?: (vote: ContentFeedbackVote | null) => void;
  onRegenerate?: () => void;
  showContinueGenerate?: boolean;
  onContinueGenerate?: () => void;
  continueGenerateLabel?: string;
  onMomentsDownloadHint?: (message: string) => void;
  actionsDisabled?: boolean;
  onGuideAction?: (body: Record<string, unknown>) => void;
}

function FavoriteStarButton({
  favorited,
  disabled,
  onClick,
}: {
  favorited: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors active:bg-slate-100",
        favorited ? "text-amber-500" : "text-slate-400",
        disabled ? "opacity-50" : "",
      ].join(" ")}
      aria-label={favorited ? "取消收藏" : "收藏"}
      title={favorited ? "取消收藏" : "收藏"}
    >
      {favorited ? (
        <svg aria-hidden className="h-[1.15rem] w-[1.15rem]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 00-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 00-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 00.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ) : (
        <svg
          aria-hidden
          className="h-[1.15rem] w-[1.15rem]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 00-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 00-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 00.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      )}
    </button>
  );
}

export function AssistantBubble({
  favorited = false,
  showFavorite = false,
  onToggleFavorite,
  leadText,
  structured,
  contentFeedback,
  onContentFeedback,
  onRegenerate,
  showContinueGenerate = false,
  onContinueGenerate,
  continueGenerateLabel,
  onMomentsDownloadHint,
  actionsDisabled,
  onGuideAction,
}: AssistantBubbleProps) {
  const showActions = Boolean(structured && onContentFeedback && onRegenerate);
  const hideLeadBecauseMomentsCard = structured?.scene === "moments_marketing";
  const favoriteOnCard = Boolean(showFavorite && onToggleFavorite && structured);
  const favoriteInHeader = Boolean(showFavorite && onToggleFavorite && !structured);

  const favoriteTrigger =
    showFavorite && onToggleFavorite ? (
      <FavoriteStarButton
        favorited={favorited}
        disabled={actionsDisabled}
        onClick={onToggleFavorite}
      />
    ) : null;

  return (
    <div className="flex justify-start px-3 pt-3">
      <div className="max-w-full min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-slate-100 text-[0.65rem] font-bold text-brand-800"
            aria-hidden
          >
            AI
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate text-[0.72rem] font-semibold text-slate-500">导购助手</span>
            {favoriteInHeader ? favoriteTrigger : null}
          </div>
        </div>
        {leadText && !hideLeadBecauseMomentsCard ? (
          <p className="text-[0.88rem] font-medium leading-relaxed text-slate-700">{leadText}</p>
        ) : null}
        {structured?.scene === "guide_turn" && onGuideAction ? (
          <GuideTurnCard data={structured} disabled={actionsDisabled} onAction={onGuideAction} />
        ) : null}
        {structured?.scene === "moments_marketing" ? (
          <div>
            <MomentsResultCard
              data={structured}
              onDownloadHint={onMomentsDownloadHint}
              headerTrailing={favoriteOnCard ? favoriteTrigger : undefined}
            />
            {onToggleFavorite ? (
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onToggleFavorite}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white text-[0.85rem] font-bold text-slate-800"
              >
                {favorited ? "已收藏这套素材" : "收藏这套素材"}
              </button>
            ) : null}
            {onRegenerate ? (
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={onRegenerate}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white text-[0.85rem] font-bold text-slate-800"
              >
                重新生成素材
              </button>
            ) : null}
            {showActions ? (
              <GenerationFeedbackBar
                feedback={contentFeedback}
                onFeedback={onContentFeedback!}
                onRegenerate={onRegenerate!}
                onContinueGenerate={showContinueGenerate ? onContinueGenerate : undefined}
                continueGenerateLabel={
                  showContinueGenerate && continueGenerateLabel ? continueGenerateLabel : undefined
                }
                disabled={actionsDisabled}
              />
            ) : null}
          </div>
        ) : null}
        {structured?.scene === "store_rag_query" ? (
          <div>
            <RagAnswerCard data={structured} headerTrailing={favoriteOnCard ? favoriteTrigger : undefined} />
            {showActions ? (
              <GenerationFeedbackBar
                feedback={contentFeedback}
                onFeedback={onContentFeedback!}
                onRegenerate={onRegenerate!}
                disabled={actionsDisabled}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
