import type { QuestionChipData } from "@/types/home";

interface QuestionChipProps {
  item: QuestionChipData;
}

const chevron = (
  <svg
    aria-hidden
    className="h-4 w-4 flex-shrink-0 text-slate-400/90"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

export function QuestionChip({ item }: QuestionChipProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-2 border-b border-slate-200/40 bg-white/90 px-5 py-4 text-left transition-colors duration-75 last:border-b-0 active:bg-slate-100"
    >
      <span className="min-w-0 flex-1 text-left text-[0.92rem] font-medium leading-[1.45] text-slate-800 sm:text-[0.95rem]">
        {item.label}
      </span>
      {chevron}
    </button>
  );
}
