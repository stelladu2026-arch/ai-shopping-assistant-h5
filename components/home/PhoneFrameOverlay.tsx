"use client";

import type { ReactNode } from "react";

interface PhoneFrameOverlayProps {
  children: ReactNode;
  onBackdropClick: () => void;
  ariaLabel: string;
}

/**
 * 与 MobileShell 手机框对齐：大屏侧栏/遮罩只在 430px 圆角设备区域内，不铺满整个浏览器。
 */
export function PhoneFrameOverlay({ children, onBackdropClick, ariaLabel }: PhoneFrameOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex justify-center sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={[
          "relative h-dvh w-full max-w-full overflow-hidden",
          "sm:h-[min(800px,calc(100dvh-3rem))] sm:max-w-[430px] sm:rounded-[26px] sm:border sm:border-white/60 sm:shadow-device sm:ring-1 sm:ring-slate-900/[0.06]",
        ].join(" ")}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 bg-slate-900/45 backdrop-blur-[1px]"
          aria-label="关闭"
          onClick={onBackdropClick}
        />
        <div className="relative z-10 h-full w-full">{children}</div>
      </div>
    </div>
  );
}
