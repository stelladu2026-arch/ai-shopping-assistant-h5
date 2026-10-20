"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getFollowUpOverride } from "@/lib/managerInsightsStorage";
import { deleteSession, importSharedSessions, listSessions } from "@/lib/sessions";
import { listFavorites, mergeServerFavorites, removeFavoriteById } from "@/lib/favorites";
import type { FavoriteRecord } from "@/types/session";
import type { SessionCenterScope, StoreDashboardMetrics, StoreSessionSummaryItem } from "@/types/store-insights";
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
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";

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
  const [storeSummaries, setStoreSummaries] = useState<StoreSessionSummaryItem[]>([]);
  const [storeMetrics, setStoreMetrics] = useState<StoreDashboardMetrics | null>(null);

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
    return storeSummaries.map((s) => ({
      ...s,
      followUpStatus: getFollowUpOverride(s.id) ?? s.followUpStatus,
    }));
  }, [tick, storeSummaries]);

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
    void fetch("/api/guide/store")
      .then((response) => response.json())
      .then((payload) => {
        importSharedSessions(payload.shares || []);
        setStoreSummaries(payload.summaries || []);
        setStoreMetrics(payload.metrics || null);
        refresh();
      })
      .catch(() => {
        setStoreSummaries([]);
        setStoreMetrics(null);
      });
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
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <Link href="/guide" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            首页
          </Link>
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">会话中心</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/chat">新对话</Link>
        </Button>
      </header>

      {!settingsHydrated ? (
        <SessionsCenterSkeleton />
      ) : (
        <>
          {isManager ? <SessionsScopeToggle value={scope} onChange={setScope} /> : null}

          {isManager && scope === "store" ? (
            <div className="min-h-0 flex-1 space-y-6 px-4 pb-6 pt-5">
              <StoreInsightsDashboard metrics={storeMetrics} />
              {mergedSummaries.length === 0 ? (
                <p className="mt-6 px-1 text-[0.82rem] leading-relaxed text-slate-500">还没有导购产生的会话。</p>
              ) : (
                <StoreSessionSummaryList
                  items={mergedSummaries}
                  onOpen={(row) => {
                    setDetailId(row.id);
                  }}
                />
              )}
            </div>
          ) : (
            <>
              <div className="px-4 pt-4">
                <SessionTabs value={tab} onChange={setTab} />
              </div>

              <div key={tab} className="min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-1 px-4 pb-6 pt-4 duration-200">
                {tab === "recent" ? (
                  sessions.length === 0 ? (
                    <EmptyState
                      title="暂无最近会话"
                      description="从首页「常用提问」或功能入口开始对话后，会话会自动保存到这里。"
                      icon="inbox"
                      action={{ label: "去首页常用提问", href: "/" }}
                    />
                  ) : (
                    <ul className="space-y-3">
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
                  <div className="space-y-8">
                    <section>
                      <SectionHeader>商品</SectionHeader>
                      <p className="-mt-1 text-[13px] leading-relaxed text-muted-foreground">同一件只留最近一条。主按钮是「用这件生成素材」。</p>
                      {splitFavorites(favorites).products.length === 0 ? (
                        <p className="mt-2 px-1 text-[0.78rem] text-slate-500">还没有收藏商品。</p>
                      ) : (
                        <ul className="mt-3 space-y-3">
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
                    <Separator />
                    <section>
                      <SectionHeader>素材</SectionHeader>
                      <p className="-mt-1 text-[13px] leading-relaxed text-muted-foreground">这里只查看和复制，不会拿去换一件商品。</p>
                      {splitFavorites(favorites).materials.length === 0 ? (
                        <p className="mt-2 px-1 text-[0.78rem] text-slate-500">还没有收藏素材。</p>
                      ) : (
                        <ul className="mt-3 space-y-3">
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
