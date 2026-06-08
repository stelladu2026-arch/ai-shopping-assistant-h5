/** 首页列表行右侧箭头（继续上次会话、功能入口、常用提问等统一规格） */
export function ListRowChevron({ className = "h-5 w-5 shrink-0 text-slate-400" }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 6l6 6-6 6" />
    </svg>
  );
}
