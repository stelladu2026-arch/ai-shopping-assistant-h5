"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface MomentsSetupSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 与页面顶部首次出现的参数卡片同款尺寸：居中叠层，仅占表单卡片大小（可滚动），非整页抽屉。
 */
export function MomentsSetupSheet({ open, onClose, children }: MomentsSetupSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center px-3 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-label="朋友圈文案配置"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[360px] max-h-[min(520px,calc(100dvh-5rem))] overflow-y-auto overscroll-contain tech-scroll">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md ring-1 ring-slate-200/80 active:bg-slate-50"
          aria-label="关闭"
        >
          <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="pr-1 pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
