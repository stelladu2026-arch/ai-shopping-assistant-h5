/** 首页列表等：右侧指引箭头（与功能入口 ActionCard 一致） */
export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className ?? "h-4 w-4 shrink-0 text-slate-400/90"}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
      />
    </svg>
  );
}
