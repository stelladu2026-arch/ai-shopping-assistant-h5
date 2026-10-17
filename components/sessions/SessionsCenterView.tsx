"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getFollowUpOverride } from "@/lib/managerInsightsStorage";
import { deleteSession, listSessions } from "@/lib/sessions";
import { listFavorites, mergeServerFavorites, removeFavoriteById } from "@/lib/favorites";
import type { FavoriteRecord } from "@/types/session";
import { storeSessionSummariesMock } from "@/mock/storeInsights";
import type { SessionCenterScope, StoreSessionSummaryItem } from "@/types/store-insights";
import { EmptyState } from "@/components/sessions/EmptyState";
import { FavoriteDrawer } from "@/components/sessions/FavoriteDrawer";
import { FavoriteListItem } from "@/components/sessions/FavoriteListItem";
import { SessionListItem } from "@/components/sessions/SessionListItem";
import { SessionTabs, type SessionHubTab } from "@/components/sessions/SessionTabs";
import { SessionsScopeToggle } from "@/components/sessions/SessionsScopeToggle";
import { StoreInsightsDashboard } from "@/components/sessions/StoreInsightsDashboard";
import { StoreSessionDetailDrawer } from "@/components/sessions/StoreSessionDetailDrawer";
import { StoreSessionSummaryList } from "@/components/sessions/StoreSessionSummaryList";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function productKey(item: FavoriteRecord) {
  const block = item.structured;
  if (block?.scene === "guide_turn") return block.confirmedFacts?.name || block.confirmedName || block.confirmedFacts?.id || item.title;
  return item.title;
}

function splitFavorites(items: FavoriteRecord[]) {
  const products: FavoriteRecord[] = [];
  const materials: FavoriteRecord[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.type === "product") {
      const key = productKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(item);
    } else if (item.type === "material" || item.type === "moments_card") {
      materials.push(item);
    }
  }
  return { products, materials };
}

function SessionsCenterSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="加载会话中心"
      className="flex-1 space-y-3 px-3 pt-3 min-h-[min(42vh,15rem)]"
    >
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          className="animate-pulse rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="h-4 w-2/3 rounded-md bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded-md bg-slate-100" />
          <div className="mt-2 h-3 w-4/5 rounded-md bg-slate-100" />
          <div className="mt-4 h-6 w-16 rounded-md bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

interface SessionsCenterViewProps {
  onToast?: (msg: string) => void;
}

export function SessionsCenterView({ onToast }: SessionsCenterViewProps) {
  const [tab, setTab] = useState<SessionHubTab>("recent");
  const [tick, setTick] = useState(0);
  const [drawerItem, setDrawerItem] = useState<FavoriteRecord | null>(null);
  const [scope, setScope] = useState<SessionCenterScope>("mine");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { isManager, isGuide, hydrated: settingsHydrated } = useAppSettings();

  /** 店长登录后会话中心默认展示「本店」数据（与导购默认「我的」区分） */
  useEffect(() => {
    if (!settingsHydrated || !isManager) return;
    setScope("store");
  }, [settingsHydrated, isManager]);

  useEffect(() => {
    if (settingsHydrated && isGuide && scope === "store") {
      setScope("mine");
    }
  }, [settingsHydrated, isGuide, scope]);

  useEffect(() => {
    if (scope !== "store") setDetailId(null);
  }, [scope]);

  const sessions = useMemo(() => {
    void tick;
    return listSessions();
  }, [tick]);

  const favorites = useMemo(() => {
    void tick;
    return listFavorites().filter((item) => item.type === "product" || item.type === "material" || item.type === "moments_card");
  }, [tick]);

  const mergedSummaries: StoreSessionSummaryItem[] = useMemo(() => {
    void tick;
    return storeSessionSummariesMock.map((s) => ({
      ...s,
      followUpStatus: getFollowUpOverride(s.id) ?? s.followUpStatus,
    }));
  }, [tick]);

  const detailSummary = useMemo(
    () => (detailId ? mergedSummaries.find((s) => s.id === detailId) ?? null : null),
    [detailId, mergedSummaries],
  );

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    void fetch("/api/guide/act")
      .then((response) => response.json())
      .then((payload) => {
        mergeServerFavorites(payload.favorites || []);
        refresh();
      })
      .catch(() => undefined);
  }, [refresh]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      refresh();
      onToast?.("已删除会话");
    },
    [onToast, refresh],
  );

  const handleRemoveFavorite = useCallback(
    (id: string) => {
      removeFavoriteById(id);
      refresh();
      onToast?.("已取消收藏");
    },
    [onToast, refresh],
  );

  const copyPlain = useCallback(
    async (plain: string) => {
      try {
        await navigator.clipboard.writeText(plain);
        onToast?.("已复制到剪贴板");
      } catch {
        onToast?.("复制失败，请重试");
      }
    },
    [onToast],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-2">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-slate-50/95 px-3 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors duration-75 active:bg-slate-200/80"
            aria-label="返回首页"
          >
            <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-[0.95rem] font-semibold text-slate-900">会话中心</h1>
          </div>
          <Link
            href="/chat"
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[0.72rem] font-semibold text-white shadow-sm active:bg-brand-700"
          >
            新对话
          </Link>
        </div>
      </header>

      {!settingsHydrated ? (
        <SessionsCenterSkeleton />
      ) : (
        <>
          {isManager ? <SessionsScopeToggle value={scope} onChange={setScope} /> : null}

          {isManager && scope === "store" ? (
            <div className="min-h-0 flex-1 px-3 pt-3">
              <StoreInsightsDashboard />
              <StoreSessionSummaryList
                items={mergedSummaries}
                onOpen={(row) => {
                  setDetailId(row.id);
                }}
              />
            </div>
          ) : (
            <>
              <SessionTabs value={tab} onChange={setTab} />

              <div className="min-h-0 flex-1 px-3 pt-3">
                {tab === "recent" ? (
                  sessions.length === 0 ? (
                    <EmptyState
                      title="暂无最近会话"
                      description="从首页「常用提问」或功能入口开始对话后，会话会自动保存到这里。"
                      icon="inbox"
                      action={{ label: "去首页常用提问", href: "/" }}
                    />
                  ) : (
                    <ul className="space-y-2.5 pb-6">
                      {sessions.map((s) => (
                        <SessionListItem
                          key={s.id}
                          session={s}
                          onDeleteClick={() => setPendingDeleteId(s.id)}
                          onRenamed={() => setTick((value) => value + 1)}
                        />
                      ))}
                    </ul>
                  )
                ) : favorites.length === 0 ? (
                  <EmptyState
                    title="暂无收藏"
                    description="在商品卡上点收藏，之后可以在这里直接生成素材。"
                    icon="star"
                    action={{ label: "进入对话去收藏", href: "/chat" }}
                  />
                ) : (
                  <div className="space-y-4 pb-6">
                    <section>
                      <h2 className="px-1 text-[0.85rem] font-bold text-slate-900">商品</h2>
                      <p className="mt-1 px-1 text-[0.78rem] leading-relaxed text-slate-600">同一件只留最近一条。主按钮是「用这件生成素材」。</p>
                      {splitFavorites(favorites).products.length === 0 ? (
                        <p className="mt-2 px-1 text-[0.78rem] text-slate-500">还没有收藏商品。</p>
                      ) : (
                        <ul className="mt-2 space-y-2.5">
                          {splitFavorites(favorites).products.map((f) => (
                            <FavoriteListItem
                              key={f.id}
                              group="product"
                              item={f}
                              onOpen={setDrawerItem}
                              onRemove={handleRemoveFavorite}
                              onCopy={copyPlain}
                            />
                          ))}
                        </ul>
                      )}
                    </section>
                    <section>
                      <h2 className="px-1 text-[0.85rem] font-bold text-slate-900">素材</h2>
                      <p className="mt-1 px-1 text-[0.78rem] leading-relaxed text-slate-600">这里只查看和复制，不会拿去换一件商品。</p>
                      {splitFavorites(favorites).materials.length === 0 ? (
                        <p className="mt-2 px-1 text-[0.78rem] text-slate-500">还没有收藏素材。</p>
                      ) : (
                        <ul className="mt-2 space-y-2.5">
                          {splitFavorites(favorites).materials.map((f) => (
                            <FavoriteListItem
                              key={f.id}
                              group="material"
                              item={f}
                              onOpen={setDrawerItem}
                              onRemove={handleRemoveFavorite}
                              onCopy={copyPlain}
                            />
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="删除会话"
        message="确定删除该会话？本地记录将被清除，且无法恢复。"
        confirmLabel="删除"
        onConfirm={() => {
          if (pendingDeleteId) handleDeleteSession(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />

      <FavoriteDrawer
        open={Boolean(drawerItem)}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        onCopy={copyPlain}
        onRemove={handleRemoveFavorite}
      />

      <StoreSessionDetailDrawer
        open={Boolean(detailSummary)}
        item={detailSummary}
        onClose={() => setDetailId(null)}
        onAfterAction={refresh}
        onToast={(msg) => onToast?.(msg)}
      />
    </div>
  );
}
