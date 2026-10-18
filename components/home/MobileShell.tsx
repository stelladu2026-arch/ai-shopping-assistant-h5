import type { ReactNode } from "react";

interface MobileShellProps {
  children: ReactNode;
  footer: ReactNode;
}

/**
 * 真机：全宽 × 动态视口高（dvh），无左右留白。
 * 大屏（≥sm）：居中手机框，宽 430px，与独立 H5 同宽。
 */
export function MobileShell({ children, footer }: MobileShellProps) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-[#e2e5ea] sm:items-center sm:px-4 sm:py-6">
      <div
        className={[
          "relative flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-50",
          "h-dvh max-h-dvh max-w-full",
          "rounded-none border-0 shadow-none ring-0",
          "sm:h-[min(800px,calc(100dvh-3rem))] sm:max-h-[min(800px,calc(100dvh-3rem))] sm:max-w-[430px]",
          "sm:rounded-[26px] sm:border sm:border-white/60 sm:shadow-device sm:ring-1 sm:ring-slate-900/[0.06]",
        ].join(" ")}
      >
        <main className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
