"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "删除",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <PhoneFrameOverlay onBackdropClick={onCancel} ariaLabel={title}>
      <div className="absolute inset-x-4 top-[22%] flex max-h-[70%] flex-col rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-900/10 sm:inset-x-auto sm:left-1/2 sm:w-[min(20rem,calc(100%-2rem))] sm:-translate-x-1/2">
        <h2 className="text-[0.95rem] font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-[0.82rem] font-medium leading-relaxed text-slate-600">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[0.82rem] font-semibold text-slate-700 active:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-[0.82rem] font-semibold text-white shadow-sm active:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </PhoneFrameOverlay>,
    document.body,
  );
}
