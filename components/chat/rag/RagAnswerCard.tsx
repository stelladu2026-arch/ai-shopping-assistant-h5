"use client";

import type { ReactNode } from "react";
import type { RagPolicyAnswer } from "@/types/agent";

interface RagAnswerCardProps {
  data: RagPolicyAnswer;
  headerTrailing?: ReactNode;
}

function buildRagCopyText(data: RagPolicyAnswer) {
  if (data.retrievalMode) return [data.policyTitle, data.synthetic ? "演示资料，不代表真实门店承诺" : "", data.suggestedScript, ...(data.sources || []).map((s,i)=>`[${i+1}] ${s.title} · ${s.section} · ${s.version} · ${s.source}`)].filter(Boolean).join("\n");
  return [
    data.policyTitle,
    ...data.priceHighlights.map((p) => `${p.label} ${p.value}`),
    `条件：${data.conditions.join("、")}`,
    `时间：${data.activityDeadline}`,
    data.suggestedScript,
  ].join("\n");
}

export function RagAnswerCard({ data, headerTrailing }: RagAnswerCardProps) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildRagCopyText(data));
    } catch {
      /* ignore */
    }
  };

  if (data.retrievalMode) return (
    <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">{data.policyTitle}</h3>{headerTrailing}</div>
      <p className="mt-2 text-xs text-amber-800">{data.synthetic ? "演示知识资料 · 不代表真实门店承诺" : "本地资料原文摘录"}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{data.suggestedScript}</p>
      {Boolean(data.sources?.length) && <details className="mt-3 border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand-700">查看 {data.sources!.length} 条出处</summary>
        {data.sources!.map((s,i)=><div key={s.id} className="mt-3 border-l-2 border-brand-200 pl-3">
          <p className="text-xs font-semibold">[{i+1}] {s.title} · {s.section}</p>
          <p className="mt-1 text-xs text-slate-500">版本 {s.version} · 有效期 {s.validFrom || "未标注"} 至 {s.validTo || "未标注"}</p>
          <blockquote className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">{s.excerpt}</blockquote>
          <p className="mt-1 break-all text-[10px] text-slate-400">{s.source} · {s.id}</p>
        </div>)}
      </details>}
      <button type="button" onClick={onCopy} className="mt-4 min-h-11 w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">复制回答与出处</button>
    </section>
  );

  return (
    <div className="mt-2 overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surface ring-1 ring-slate-900/[0.04]">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2">
        <h3 className="min-w-0 flex-1 text-[0.95rem] font-bold leading-snug text-slate-900">{data.policyTitle}</h3>
        {headerTrailing ? <div className="shrink-0 pt-0.5">{headerTrailing}</div> : null}
      </div>

      <div className="space-y-3 px-3 py-3">
        <div>
          <p className="text-[0.65rem] font-semibold text-slate-400">核心价格</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.priceHighlights.map((p) => (
              <div
                key={`${p.label}-${p.value}`}
                className="rounded-xl border border-brand-200/70 bg-brand-50/80 px-3 py-2"
              >
                <p className="text-[0.62rem] font-semibold text-slate-500">{p.label}</p>
                <p className="text-[1.35rem] font-black tabular-nums tracking-tight text-brand-700">
                  {p.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] font-semibold text-slate-400">适用条件</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.conditions.map((c) => (
              <span
                key={c}
                className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-slate-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] font-semibold text-slate-400">活动时间</p>
          <p className="mt-1 text-[0.88rem] font-bold text-amber-800">{data.activityDeadline}</p>
        </div>

        <p className="text-[0.84rem] font-medium leading-relaxed text-slate-800">{data.suggestedScript}</p>

        {data.relatedProducts.length > 0 ? (
          <div>
            <p className="text-[0.65rem] font-semibold text-slate-400">关联商品</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
              {data.relatedProducts.map((p) => (
                <div
                  key={p.id}
                  className="w-[5.5rem] shrink-0 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm"
                >
                  <div className="flex aspect-square items-center justify-center bg-slate-100 text-[0.95rem] font-bold text-slate-600">
                    {p.shortLabel}
                  </div>
                  <p className="line-clamp-2 px-1.5 py-1.5 text-[0.65rem] font-semibold leading-snug text-slate-800">
                    {p.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={onCopy}
          className="flex w-full items-center justify-center rounded-xl bg-brand-600 py-2.5 text-[0.8rem] font-bold text-white shadow-sm transition-colors duration-75 active:bg-brand-700"
        >
          一键复制
        </button>
      </div>
    </div>
  );
}
