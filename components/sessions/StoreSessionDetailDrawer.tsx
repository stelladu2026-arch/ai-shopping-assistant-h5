"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";
import { addManagerTemplate, setFollowUpOverride } from "@/lib/managerInsightsStorage";
import type { FollowUpStatus, StoreSessionSummaryItem } from "@/types/store-insights";

const followOptions: FollowUpStatus[] = ["已处理", "待补充知识点", "待辅导", "已沉淀模板"];

interface StoreSessionDetailDrawerProps {
  open: boolean;
  item: StoreSessionSummaryItem | null;
  onClose: () => void;
  onAfterAction: () => void;
  onToast: (msg: string) => void;
}

function reviewHint(s: StoreSessionSummaryItem): string {
  if (s.reviewSuggestion === "无") {
    return "当前摘要未触发专项复核；可按门店规范按需核对。";
  }
  if (s.reviewSuggestion === "建议二次核对（参数）") {
    return "建议二次核对（参数）：涉及材质、交付、计价等关键条款，核对无误后再对客户作出口径承诺。";
  }
  return "建议二次核对（活动）：涉及满减、叠加、时效等活动规则，核对无误后再向客户统一说明。";
}

export function StoreSessionDetailDrawer({ open, item, onClose, onAfterAction, onToast }: StoreSessionDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !item || !mounted) return null;

  const setStatus = (st: FollowUpStatus) => {
    setFollowUpOverride(item.id, st);
    onAfterAction();
    onToast("已更新跟进状态");
  };

  const markKnowledge = () => {
    setFollowUpOverride(item.id, "待补充知识点");
    onAfterAction();
    onToast("已标记为待补充知识点，将纳入门店知识补全清单（演示）");
  };

  const saveTemplate = () => {
    const excerpt = [item.bullets.join("；"), item.conclusion].filter(Boolean).join(" — ");
    addManagerTemplate({
      title: `【${item.guideName}】${item.subject}`,
      subject: item.subject,
      guideName: item.guideName,
      excerpt: excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt,
      sourceSummaryId: item.id,
    });
    setFollowUpOverride(item.id, "已沉淀模板");
    onAfterAction();
    onToast("已沉淀为模板，可在后续培训中复用（演示，已保存到本地）");
  };

  return createPortal(
    <PhoneFrameOverlay onBackdropClick={onClose} ariaLabel="本店会话摘要详情">
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,36rem)] flex-col rounded-t-[1.25rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)]">
        <div className="flex shrink-0 items-center justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        </div>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 pb-3 pt-1">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">本店摘要</p>
            <h2 className="mt-0.5 text-[0.95rem] font-bold leading-snug text-slate-900">{item.subject}</h2>
            <p className="mt-1 text-[0.72rem] font-medium text-slate-500">
              导购 {item.guideName} · {item.relativeTime}
            </p>
          </div>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 tech-scroll">
          <p className="text-[0.7rem] font-bold text-slate-400">复核建议</p>
          <p className="mt-1 text-[0.8rem] font-medium leading-relaxed text-slate-700">{reviewHint(item)}</p>
          <p className="mt-1 text-[0.72rem] font-semibold text-brand-800">
            当前标注：{item.reviewSuggestion === "无" ? "未标记专项复核" : item.reviewSuggestion}
          </p>

          <p className="mt-4 text-[0.7rem] font-bold text-slate-400">结构化要点</p>
          <ul className="mt-1.5 space-y-1.5">
            {item.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-[0.82rem] font-medium leading-relaxed text-slate-800">
                <span className="text-brand-600">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[0.7rem] font-bold text-slate-400">关键结论</p>
          <p className="mt-1 text-[0.82rem] font-medium leading-relaxed text-slate-800">{item.conclusion}</p>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400" htmlFor="fu-status">
              跟进状态
            </label>
            <select
              id="fu-status"
              value={item.followUpStatus}
              onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[0.8rem] font-semibold text-slate-900"
            >
              {followOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[0.65rem] font-medium text-slate-500">状态会保存在本机，用于演示门店协同流程。</p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.5rem))]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={markKnowledge}
              className="rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-[0.78rem] font-semibold text-orange-950 active:bg-orange-100"
            >
              标记待补充知识点
            </button>
            <button
              type="button"
              onClick={saveTemplate}
              className="rounded-xl bg-brand-600 py-2.5 text-[0.78rem] font-semibold text-white shadow-sm active:bg-brand-700"
            >
              沉淀为模板
            </button>
          </div>
        </div>
      </div>
    </PhoneFrameOverlay>,
    document.body,
  );
}
