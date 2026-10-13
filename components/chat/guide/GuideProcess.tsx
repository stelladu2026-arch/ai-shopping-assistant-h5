"use client";

import { useState } from "react";
import type { GuideTurnBlock } from "@/types/agent";

export function GuideProcess({
  process,
  reflection,
}: {
  process?: GuideTurnBlock["process"] | null;
  reflection?: GuideTurnBlock["reflection"] | null;
}) {
  const [open, setOpen] = useState(false);
  const hasReflection = Boolean(reflection?.checks?.length);
  if (!process && !hasReflection) return null;

  const rag = process?.rag?.hit
    ? `${process.rag.title ? `《${process.rag.title}》` : ""}${process.rag.excerpt}`
    : process?.rag?.excerpt || "没有检索到。";

  return (
    <section data-process="guide" className="px-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-1.5 text-left text-slate-500"
        aria-expanded={open}
      >
        <span aria-hidden className={open ? "text-[0.85rem]" : "text-[0.85rem]"}>
          {open ? "▾" : "›"}
        </span>
        <span className="text-[0.82rem] font-semibold">这次怎么做到的</span>
      </button>
      {open ? (
        <div className="space-y-3 border-l border-slate-200 pb-2 pl-3">
          {process ? (
            <>
              <div>
                <h3 className="text-[0.8rem] font-bold text-slate-900">工作流</h3>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">当前步骤：{process.workflow.step}</p>
                <p className="text-[0.78rem] leading-relaxed text-slate-700">为什么到这一步：{process.workflow.why}</p>
                <p className="text-[0.78rem] leading-relaxed text-slate-700">状态：{process.workflow.status}</p>
              </div>
              <div>
                <h3 className="text-[0.8rem] font-bold text-slate-900">资料检索（RAG）</h3>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">{rag}</p>
              </div>
              <div>
                <h3 className="text-[0.8rem] font-bold text-slate-900">自主 Agent</h3>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">这一步自己决定：{process.agent.did}</p>
                <p className="text-[0.78rem] leading-relaxed text-slate-700">不能做：{process.agent.cannot}</p>
              </div>
              {process.usage ? (
                <div>
                  <h3 className="text-[0.8rem] font-bold text-slate-900">本次次数</h3>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">
                    资料检索 {process.usage.retrieve.used}/{process.usage.retrieve.limit}，商品决策 {process.usage.product_decision.used}/{process.usage.product_decision.limit}，内容生成 {process.usage.content.used}/{process.usage.content.limit}，生图 {process.usage.image.used}/{process.usage.image.limit}
                    {Object.values(process.usage).some((item) => item.used >= item.limit) ? "。已达本次上限。下一步：换条件、确认已列出的商品，或复制已有素材。" : ""}
                  </p>
                </div>
              ) : null}
              {process.clarify?.length ? (
                <div>
                  <h3 className="text-[0.8rem] font-bold text-slate-900">追问</h3>
                  {process.clarify.map((item) => (
                    <p key={item.doubt} className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">
                      {item.doubt}追问到第 {item.rounds} 次，上限 {item.limit} 轮。{item.capped ? "已不再重复同一句。" : ""}
                    </p>
                  ))}
                </div>
              ) : null}
              {process.failure ? (
                <div>
                  <h3 className="text-[0.8rem] font-bold text-slate-900">失败类型</h3>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">{process.failure.text}</p>
                </div>
              ) : null}
              {process.degraded?.length ? (
                <div>
                  <h3 className="text-[0.8rem] font-bold text-slate-900">降级</h3>
                  <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-700">{process.degraded.join("、")}：未核对，不能当作事实</p>
                </div>
              ) : null}
            </>
          ) : null}
          {hasReflection && reflection ? (
            <div id="reflection">
              <h3 className="text-[0.8rem] font-bold text-slate-900">
                {reflection.pending_review ? "反思核查 · 待核对" : "反思核查"}
              </h3>
              <div className="mt-1 space-y-1">
                {reflection.checks.map((check, index) => (
                  <p key={`${check.name}-${index}`} className={check.ok ? "text-[0.78rem] text-slate-700" : "text-[0.78rem] font-semibold text-orange-800"}>
                    {check.ok ? "通过" : "未通过"} · {check.name} · {check.detail}
                  </p>
                ))}
              </div>
              {reflection.note ? <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-500">{reflection.note}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
