"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";
import { listFavorites } from "@/lib/favorites";
import { listSessions } from "@/lib/sessions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface SessionHubSheetProps {
  open: boolean;
  onClose: () => void;
  /** 政策查询历史，与会话列表同屏展示 */
  ragQueryHistory?: string[];
  onPickRagQuery?: (q: string) => void;
  onRemoveRagQuery?: (q: string) => void;
  onClearRagQuery?: () => void;
}

export function SessionHubSheet({
  open,
  onClose,
  ragQueryHistory = [],
  onPickRagQuery,
  onRemoveRagQuery,
  onClearRagQuery,
}: SessionHubSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTick((t) => t + 1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const sessionsPreview = useMemo(() => {
    void tick;
    return listSessions().slice(0, 5);
  }, [tick]);

  const showRagBlock = Boolean(onPickRagQuery);

  const favoritesPreview = useMemo(() => {
    void tick;
    const items = listFavorites();
    const products: typeof items = [];
    const materials: typeof items = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (item.type === "product") {
        const key = item.structured?.scene === "guide_turn"
          ? item.structured.confirmedFacts?.name || item.structured.confirmedName || item.structured.confirmedFacts?.id || item.title
          : item.title;
        if (seen.has(key)) continue;
        seen.add(key);
        products.push(item);
      } else if (item.type === "material" || item.type === "moments_card") {
        materials.push(item);
      }
    }
    return { products: products.slice(0, 3), materials: materials.slice(0, 3) };
  }, [tick]);

  if (!open || !mounted) return null;

  return createPortal(
    <PhoneFrameOverlay onBackdropClick={onClose} ariaLabel="会话">
      <aside className="absolute right-0 top-0 flex h-full w-[min(20rem,90%)] max-w-[320px] flex-col bg-white shadow-[-8px_0_32px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">
          <div>
            <h2 className="text-[0.9rem] font-bold text-slate-900">会话</h2>
            <Link
              href="/sessions"
              onClick={onClose}
              className="mt-0.5 inline-block text-[0.65rem] font-semibold text-brand-700 active:underline"
            >
              查看会话中心 ›
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showRagBlock && ragQueryHistory.length > 0 && onClearRagQuery ? (
              <button
                type="button"
                onClick={() => onClearRagQuery()}
                className="rounded-lg px-2 py-1 text-[0.7rem] font-semibold text-slate-500 transition-colors duration-75 active:bg-slate-100"
              >
                清空查询
              </button>
            ) : null}
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 tech-scroll">
          <section className="mb-4">
            <h3 className="mb-1.5 px-2 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">最近</h3>
            {sessionsPreview.length === 0 && (!showRagBlock || ragQueryHistory.length === 0) ? (
              <p className="px-2 py-2 text-[0.75rem] font-medium text-slate-500">
                暂无记录。发起选品后会出现在这里。
              </p>
            ) : (
              <ul className="space-y-1">
                {sessionsPreview.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/chat?sessionId=${encodeURIComponent(row.id)}`}
                      onClick={onClose}
                      className="block rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 active:bg-white"
                    >
                      <p className="text-[0.8rem] font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[0.68rem] font-medium text-slate-500">
                        {row.sceneTag} · {formatRelativeTime(row.updatedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
                {showRagBlock
                  ? ragQueryHistory.map((q) => (
                      <li key={`rag-${q}`}>
                        <div className="flex items-stretch gap-0.5 rounded-xl border border-slate-100 bg-slate-50/80">
                          <button
                            type="button"
                            onClick={() => {
                              onPickRagQuery?.(q);
                              onClose();
                            }}
                            className="min-w-0 flex-1 px-2.5 py-2.5 text-left text-[0.8rem] font-medium leading-snug text-slate-800 transition-colors duration-75 active:bg-white"
                          >
                            {q}
                          </button>
                          {onRemoveRagQuery ? (
                            <button
                              type="button"
                              onClick={() => onRemoveRagQuery(q)}
                              className="flex w-9 shrink-0 items-center justify-center rounded-r-xl text-slate-400 transition-colors duration-75 active:bg-slate-200/60"
                              aria-label={`删除：${q}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))
                  : null}
              </ul>
            )}
          </section>

          <section className="mb-2">
            <h3 className="mb-1.5 px-2 text-[0.72rem] font-bold text-slate-500">收藏</h3>
            {favoritesPreview.products.length === 0 && favoritesPreview.materials.length === 0 ? (
              <p className="px-2 py-2 text-[0.75rem] font-medium leading-relaxed text-slate-500">在商品卡上点收藏，之后可以在这里直接生成素材。</p>
            ) : (
              <div className="space-y-2">
                <p className="px-2 text-[0.72rem] font-bold text-slate-800">商品</p>
                {favoritesPreview.products.length === 0 ? (
                  <p className="px-2 text-[0.75rem] text-slate-500">还没有收藏商品。</p>
                ) : (
                  <ul className="space-y-1">
                    {favoritesPreview.products.map((row) => (
                      <li key={row.id}>
                        <Link href="/sessions" onClick={onClose} className="block rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-[0.8rem] font-semibold text-slate-800 active:bg-slate-50">
                          {row.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="px-2 text-[0.72rem] font-bold text-slate-800">素材</p>
                {favoritesPreview.materials.length === 0 ? (
                  <p className="px-2 text-[0.75rem] text-slate-500">还没有收藏素材。</p>
                ) : (
                  <ul className="space-y-1">
                    {favoritesPreview.materials.map((row) => (
                      <li key={row.id}>
                        <Link href="/sessions" onClick={onClose} className="block rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-[0.8rem] font-semibold text-slate-800 active:bg-slate-50">
                          {row.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </PhoneFrameOverlay>,
    document.body,
  );
}
