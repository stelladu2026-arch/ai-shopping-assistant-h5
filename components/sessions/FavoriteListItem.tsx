"use client";

import type { FavoriteContentType, FavoriteRecord } from "@/types/session";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

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

interface FavoriteListItemProps {
  item: FavoriteRecord;
  onOpen: (item: FavoriteRecord) => void;
  onRemove: (id: string) => void;
  onCopy: (plain: string) => void;
}

export function FavoriteListItem({ item, onOpen, onRemove, onCopy }: FavoriteListItemProps) {
  return (
    <li className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-3 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left transition-colors active:opacity-90"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-[0.88rem] font-semibold leading-snug text-slate-900">{item.title}</h3>
          <span className="shrink-0 text-[0.68rem] font-medium tabular-nums text-slate-400">
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-800 ring-1 ring-brand-100/80">
            {typeLabel(item.type)}
          </span>
        </div>
        <p className="mt-1.5 truncate font-mono text-[0.65rem] font-medium text-slate-400" title={item.sessionId}>
          来源会话：{item.sessionId}
        </p>
      </button>
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={() => onCopy(item.contentPlain)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50 py-2 text-[0.72rem] font-semibold text-slate-700 active:bg-slate-100"
        >
          <svg aria-hidden className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          复制
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="rounded-lg px-3 py-2 text-[0.72rem] font-semibold text-slate-500 active:bg-slate-100"
        >
          取消收藏
        </button>
      </div>
    </li>
  );
}
