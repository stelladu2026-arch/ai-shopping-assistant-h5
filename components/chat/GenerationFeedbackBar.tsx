"use client";

import type { ContentFeedbackVote } from "@/types/chat";

interface GenerationFeedbackBarProps {
  feedback: ContentFeedbackVote | null | undefined;
  onFeedback: (vote: ContentFeedbackVote | null) => void;
  onRegenerate: () => void;
  /** 朋友圈等场景：与「重新生成」同排，靠右 */
  onContinueGenerate?: () => void;
  continueGenerateLabel?: string;
  disabled?: boolean;
}

export function GenerationFeedbackBar({
  feedback,
  onFeedback,
  onRegenerate,
  onContinueGenerate,
  continueGenerateLabel,
  disabled,
}: GenerationFeedbackBarProps) {
  const likeOn = feedback === "like";
  const dislikeOn = feedback === "dislike";

  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5 px-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFeedback(likeOn ? null : "like")}
        className={[
          "inline-flex h-8 items-center gap-0.5 rounded-lg border px-2 text-[0.68rem] font-semibold transition-colors duration-75",
          likeOn
            ? "border-emerald-500 bg-emerald-100 text-emerald-950 shadow-sm"
            : "border-slate-200/80 bg-white text-slate-600 active:bg-slate-100",
          disabled ? "pointer-events-none opacity-45" : "",
        ].join(" ")}
        aria-pressed={likeOn}
        aria-label="匹配，点赞"
        title="匹配"
      >
        <span className="text-[0.85rem]" aria-hidden>
          👍
        </span>
        赞
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFeedback(dislikeOn ? null : "dislike")}
        className={[
          "inline-flex h-8 items-center gap-0.5 rounded-lg border px-2 text-[0.68rem] font-semibold transition-colors duration-75",
          dislikeOn
            ? "border-rose-500 bg-rose-100 text-rose-950 shadow-sm"
            : "border-slate-200/80 bg-white text-slate-600 active:bg-slate-100",
          disabled ? "pointer-events-none opacity-45" : "",
        ].join(" ")}
        aria-pressed={dislikeOn}
        aria-label="不匹配，点踩"
        title="不匹配"
      >
        <span className="text-[0.85rem]" aria-hidden>
          👎
        </span>
        踩
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onRegenerate}
        className="inline-flex h-8 items-center rounded-lg border border-slate-200/80 bg-white px-2.5 text-[0.68rem] font-semibold text-slate-700 transition-colors duration-75 active:bg-slate-100 disabled:pointer-events-none disabled:opacity-45"
        aria-label="重新生成"
        title="重新生成"
      >
        重新生成
      </button>
      {onContinueGenerate && continueGenerateLabel ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onContinueGenerate}
          className="inline-flex h-8 items-center rounded-lg border border-slate-200/80 bg-white px-2.5 text-[0.68rem] font-semibold text-slate-700 transition-colors duration-75 active:bg-slate-100 disabled:pointer-events-none disabled:opacity-45"
          aria-label={continueGenerateLabel}
          title={continueGenerateLabel}
        >
          {continueGenerateLabel}
        </button>
      ) : null}
    </div>
  );
}
