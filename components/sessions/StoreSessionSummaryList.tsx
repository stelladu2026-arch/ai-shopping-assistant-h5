"use client";

import type { FollowUpStatus, RiskDomain, StoreSessionSummaryItem } from "@/types/store-insights";

const riskClass: Record<RiskDomain, string> = {
  参数: "bg-rose-50 text-rose-900 ring-rose-100/90",
  活动: "bg-amber-50 text-amber-950 ring-amber-100/90",
};

const followClass: Record<FollowUpStatus, string> = {
  已处理: "bg-emerald-50 text-emerald-900 ring-emerald-100/80",
  待补充知识点: "bg-orange-50 text-orange-950 ring-orange-100/80",
  待辅导: "bg-violet-50 text-violet-900 ring-violet-100/80",
  已沉淀模板: "bg-brand-50 text-brand-900 ring-brand-100/80",
};

interface StoreSessionSummaryListProps {
  items: StoreSessionSummaryItem[];
  onOpen: (item: StoreSessionSummaryItem) => void;
}

export function StoreSessionSummaryList({ items, onOpen }: StoreSessionSummaryListProps) {
  return (
    <section className="mt-6 space-y-2 pb-4">
      <h2 className="px-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">本店会话摘要</h2>
      <p className="px-0.5 text-[0.68rem] font-medium leading-relaxed text-slate-500">
        以下为结构化摘要，不含完整对话原文。涉及参数或活动时，复核提示统一为「建议二次核对（参数/活动）」口径。
      </p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="w-full rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 text-left shadow-sm ring-1 ring-slate-900/[0.03] transition-colors active:bg-slate-50/90"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-semibold text-slate-500">
                    {item.guideName}
                    <span className="mx-1 text-slate-300">·</span>
                    <span className="tabular-nums text-slate-400">{item.relativeTime}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[0.88rem] font-semibold leading-snug text-slate-900">{item.subject}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`rounded-md px-2 py-0.5 text-[0.62rem] font-semibold ring-1 ${riskClass[item.riskDomain]}`}>
                  {item.riskDomain}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[0.62rem] font-semibold ring-1 ${followClass[item.followUpStatus]}`}>
                  {item.followUpStatus}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[0.72rem] font-medium text-slate-600">
                {item.bullets.slice(0, 2).map((b) => (
                  <li key={b} className="flex gap-1.5">
                    <span className="text-brand-600" aria-hidden>
                      •
                    </span>
                    <span className="line-clamp-2 min-w-0">{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 line-clamp-2 text-[0.72rem] font-semibold text-slate-700">{item.conclusion}</p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
