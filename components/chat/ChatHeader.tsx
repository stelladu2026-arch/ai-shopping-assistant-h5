"use client";

import Link from "next/link";

interface ChatHeaderProps {
  onOpenSessionHub: () => void;
}

export function ChatHeader({ onOpenSessionHub }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-1 border-b border-slate-200/60 bg-slate-50/95 px-3 py-3 backdrop-blur-sm">
      <div className="flex w-9 shrink-0 justify-start">
        <Link
          href="/sessions"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors duration-75 active:bg-slate-200/80"
          aria-label="返回会话中心"
        >
          <svg
            aria-hidden
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      </div>
      <h1 className="min-w-0 truncate text-center text-[0.95rem] font-semibold leading-snug text-slate-900">
        AI导购助手
      </h1>
      <div className="flex shrink-0 items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={onOpenSessionHub}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors duration-75 active:bg-slate-200/80"
          aria-label="会话侧栏"
          title="会话"
        >
          <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
