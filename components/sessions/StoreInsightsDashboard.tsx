"use client";

import { useEffect, useState } from "react";
import { storeDashboardMock } from "@/mock/storeInsights";

type CozeBanner =
  | { status: "loading" }
  | { status: "ok"; botCount: number }
  | { status: "error"; message: string };

export function StoreInsightsDashboard() {
  const m = storeDashboardMock;
  const { product, campaign, copy: copyIntent } = m.intentShare;

  const [coze, setCoze] = useState<CozeBanner>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/manager/coze/workspace-summary")
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; botCount?: number; error?: string };
        if (cancelled) return;
        if (res.ok && data.ok && typeof data.botCount === "number") {
          setCoze({ status: "ok", botCount: data.botCount });
        } else {
          setCoze({
            status: "error",
            message: typeof data.error === "string" ? data.error : `请求失败 (${res.status})`,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setCoze({ status: "error", message: "网络异常" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const cards = [
    ...(coze.status === "ok"
      ? [
          {
            label: "Coze · 已发布 Bot",
            value: String(coze.botCount),
            hint: "当前 Workspace（开放平台 PAT）",
          },
        ]
      : coze.status === "loading"
        ? [
            {
              label: "Coze 连接",
              value: "…",
              hint: "正在校验开放平台与工作空间",
            },
          ]
        : coze.status === "error"
          ? [
              {
                label: "Coze 连接",
                value: "—",
                hint: coze.message,
              },
            ]
          : []),
    {
      label: "活跃导购数",
      value: String(m.activeGuides),
      hint: "本周有会话记录的导购",
    },
    {
      label: "本周会话量",
      value: String(m.weeklySessionCount),
      hint: "本店演示口径 · 自然周",
    },
    {
      label: "意图分布",
      value: `${pct(product)} / ${pct(campaign)} / ${pct(copyIntent)}`,
      hint: "产品 / 活动 / 文案（演示归类）",
    },
    {
      label: "复制率 · 重新生成率",
      value: `${pct(m.copyRate)} · ${pct(m.regenerateRate)}`,
      hint: "基于本会话样本估算（演示）",
    },
  ];

  return (
    <section className="mt-3 space-y-2">
      <h2 className="px-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">本店看板</h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200/70 bg-white px-3 py-3 shadow-sm ring-1 ring-slate-900/[0.03]"
          >
            <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-1.5 text-[1.05rem] font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="mt-1 text-[0.62rem] font-medium leading-snug text-slate-500">{c.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
