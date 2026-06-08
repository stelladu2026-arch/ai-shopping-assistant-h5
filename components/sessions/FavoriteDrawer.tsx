"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";
import { stringifyStructuredBlock } from "@/types/agent";
import type { FavoriteContentType, FavoriteRecord } from "@/types/session";

function typeLabel(t: FavoriteContentType): string {
  switch (t) {
    case "moments_card":
      return "朋友圈文案";
    case "rag_card":
      return "政策摘要";
    case "text_reply":
      return "话术回复";
    default:
      return "内容";
  }
}

interface FavoriteDrawerProps {
  open: boolean;
  item: FavoriteRecord | null;
  onClose: () => void;
  onCopy: (plain: string) => void;
  onRemove: (id: string) => void;
}

export function FavoriteDrawer({ open, item, onClose, onCopy, onRemove }: FavoriteDrawerProps) {
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

  if (!open || !item || !mounted) return null;

  const structuredText = item.structured ? stringifyStructuredBlock(item.structured) : "";

  return createPortal(
    <PhoneFrameOverlay onBackdropClick={onClose} ariaLabel="收藏详情">
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(85dvh,32rem)] flex-col rounded-t-[1.25rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)]">
        <div className="flex shrink-0 items-center justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        </div>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 pb-3 pt-2">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">收藏</p>
            <h2 className="mt-0.5 text-[0.95rem] font-bold leading-snug text-slate-900">{item.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-800 ring-1 ring-brand-100/80">
                {typeLabel(item.type)}
              </span>
              <span className="text-[0.72rem] font-medium text-slate-500">来源会话：{item.sessionTitle}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-slate-500" title={item.sessionId}>
                ID：{item.sessionId}
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(item.sessionId);
                }}
                className="shrink-0 rounded-lg px-2 py-1 text-[0.65rem] font-semibold text-brand-700 ring-1 ring-brand-200/70 active:bg-brand-50"
              >
                复制 ID
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
            aria-label="关闭"
          >
            <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 tech-scroll">
          {item.contentPlain ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-[0.82rem] font-medium leading-relaxed text-slate-700">
              {item.contentPlain}
            </pre>
          ) : null}
          {structuredText && structuredText !== item.contentPlain.trim() ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-[0.7rem] font-bold text-slate-400">结构化摘要</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-[0.78rem] font-medium leading-relaxed text-slate-600">
                {structuredText}
              </pre>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.5rem))]">
          <button
            type="button"
            onClick={() => onCopy(item.contentPlain)}
            className="flex flex-1 items-center justify-center rounded-xl bg-brand-600 py-3 text-[0.82rem] font-semibold text-white shadow-sm active:bg-brand-700"
          >
            复制全文
          </button>
          <Link
            href={`/chat?sessionId=${encodeURIComponent(item.sessionId)}`}
            onClick={onClose}
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-[0.82rem] font-semibold text-slate-800 active:bg-slate-50"
          >
            打开会话
          </Link>
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => {
              onRemove(item.id);
              onClose();
            }}
            className="w-full rounded-xl py-2.5 text-[0.8rem] font-semibold text-red-600 active:bg-red-50"
          >
            取消收藏
          </button>
        </div>
      </div>
    </PhoneFrameOverlay>,
    document.body,
  );
}
