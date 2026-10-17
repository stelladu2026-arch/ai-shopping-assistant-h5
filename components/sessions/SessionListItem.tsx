"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChatSessionRecord, SessionSceneCategory } from "@/types/session";
import { deriveSessionCategoryLabel, renameSessionCustomer, sessionMessagesCombined } from "@/lib/sessions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface SessionListItemProps {
  session: ChatSessionRecord;
  /** 用户确认删除前由上层弹出二次确认 */
  onDeleteClick: () => void;
  onRenamed: () => void;
}

const categoryBadgeClass: Record<SessionSceneCategory, string> = {
  产品: "bg-emerald-50 text-emerald-800 ring-emerald-100/90",
  活动: "bg-amber-50 text-amber-900 ring-amber-100/90",
  文案: "bg-brand-50 text-brand-800 ring-brand-100/80",
  对比: "bg-violet-50 text-violet-900 ring-violet-100/90",
};

export function SessionListItem({ session, onDeleteClick, onRenamed }: SessionListItemProps) {
  const href = `/chat?sessionId=${encodeURIComponent(session.id)}`;
  const preview = session.lastPreview.trim() || "（暂无摘要）";
  const category = deriveSessionCategoryLabel(sessionMessagesCombined(session), session.sceneMode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.customerName || "");

  return (
    <li className="group relative rounded-xl border border-slate-200/60 bg-white px-3.5 py-3 shadow-sm">
      <Link
        href={href}
        className="block rounded-lg transition-colors active:bg-slate-50/90"
      >
        <div className="flex items-start justify-between gap-2 pr-8">
          <h3 className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold leading-snug text-slate-900">
            {session.title}
          </h3>
          <span className="shrink-0 text-[0.68rem] font-medium tabular-nums text-slate-400">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[0.75rem] font-medium leading-relaxed text-slate-500">{preview}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex rounded-md px-2 py-0.5 text-[0.65rem] font-semibold ring-1",
              categoryBadgeClass[category],
            ].join(" ")}
          >
            {category}
          </span>
          {session.customerName ? (
            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600">
              客户
            </span>
          ) : null}
        </div>
      </Link>
      {editing ? (
        <form
          className="mt-2 flex items-center gap-2 pr-10"
          onSubmit={(event) => {
            event.preventDefault();
            renameSessionCustomer(session.id, draft);
            setEditing(false);
            onRenamed();
          }}
        >
          <input
            aria-label="客户名称"
            maxLength={20}
            value={draft}
            placeholder="客户名称"
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[0.85rem] text-slate-900"
          />
          <button type="submit" className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-[0.75rem] font-semibold text-white">
            保存
          </button>
          <button
            type="button"
            className="shrink-0 px-1 text-[0.75rem] font-semibold text-slate-500"
            onClick={() => setEditing(false)}
          >
            取消
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="mt-1 px-1 text-left text-[0.75rem] font-semibold text-brand-700"
          onClick={() => {
            setDraft(session.customerName || "");
            setEditing(true);
          }}
        >
          {session.customerName ? "修改客户名" : "改成客户名"}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteClick();
        }}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-100 transition-opacity active:bg-slate-100 group-hover:text-slate-600"
        aria-label="删除会话"
      >
        <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </li>
  );
}
