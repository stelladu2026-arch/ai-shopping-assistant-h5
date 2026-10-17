"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/icons/ChevronRightIcon";
import { getLastActiveSessionId, pullSharedSessions } from "@/lib/sessions";

interface ResumeSessionEntryProps {
  sectionTitle: string;
}

export function ResumeSessionEntry({ sectionTitle }: ResumeSessionEntryProps) {
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  useEffect(() => {
    void pullSharedSessions().finally(() => setLastSessionId(getLastActiveSessionId()));
  }, []);

  return (
    <section className="mt-4 sm:mt-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-4 w-0.5 flex-shrink-0 rounded-full bg-brand-600" aria-hidden />
          <h2 className="text-[0.9rem] font-semibold leading-snug tracking-wide text-slate-500 sm:text-[0.95rem]">
            {sectionTitle}
          </h2>
        </div>
      </div>
      <div className="overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surfaceLg ring-1 ring-slate-900/[0.04]">
        {lastSessionId ? (
          <Link
            href={`/chat?sessionId=${encodeURIComponent(lastSessionId)}`}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-75 active:bg-slate-50"
          >
            <span className="min-w-0 text-[0.95rem] font-semibold text-slate-900">继续上次会话</span>
            <ChevronRightIcon />
          </Link>
        ) : (
          <div className="flex flex-col gap-2 px-5 py-4">
            <p className="text-[0.82rem] font-medium leading-relaxed text-slate-500">暂无本地会话记录。</p>
            <Link
              href="/sessions"
              className="inline-flex w-fit items-center text-[0.82rem] font-semibold text-brand-700 active:underline"
            >
              去会话中心开启新对话 ›
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
