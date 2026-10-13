"use client";

import { storeDashboardMock } from "@/mock/storeInsights";

export function StoreInsightsDashboard() {
  const m = storeDashboardMock;
  const { product, campaign, copy: copyIntent } = m.intentShare;

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const cards = [
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
