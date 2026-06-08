import type { ReactNode } from "react";

interface TopNavProps {
  title: string;
  /** 右侧区域，例如头像入口 */
  endSlot?: ReactNode;
}

export function TopNav({ title, endSlot }: TopNavProps) {
  return (
    <header className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200/60 bg-white/90 px-2 pb-3.5 pt-5 sm:pb-4 sm:pt-6">
      <span className="w-9 shrink-0" aria-hidden />
      <h1 className="min-w-0 truncate text-center text-[1.15rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.28rem]">
        {title}
      </h1>
      <div className="flex shrink-0 items-center justify-end">{endSlot}</div>
    </header>
  );
}
