"use client";

import { useEffect, useState } from "react";

interface ConstraintTag {
  field: string;
  value: string | number;
  label: string;
  strength: "hard" | "prefer";
  locked: boolean;
}

interface ProbeOption {
  field: string;
  label: string;
  count: number;
}

interface ProbeInfo {
  field?: string;
  label: string;
  ids?: string[];
  count?: number;
  needsConfirm?: boolean;
  options?: ProbeOption[];
}

interface ConstraintTagsProps {
  tags: ConstraintTag[];
  probe?: ProbeInfo | null;
  disabled?: boolean;
  revision: number;
  onAction: (body: Record<string, unknown>) => void;
}

function TagEditor({
  tag,
  disabled,
  revision,
  onAction,
}: {
  tag: ConstraintTag;
  disabled?: boolean;
  revision: number;
  onAction: (body: Record<string, unknown>) => void;
}) {
  const numeric = tag.field === "budget_max_cny" || tag.field === "width_max_cm";
  const [draft, setDraft] = useState(String(tag.value));
  useEffect(() => {
    setDraft(String(tag.value));
  }, [tag.field, tag.value]);
  const nextStrength = tag.strength === "hard" ? "prefer" : "hard";
  const dirty = draft.trim() !== "" && draft.trim() !== String(tag.value);

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
      <span className="text-[0.78rem] font-semibold text-slate-800">{tag.label}</span>
      <input
        value={draft}
        disabled={disabled}
        inputMode={numeric ? "numeric" : "text"}
        aria-label={`修改${tag.label}`}
        onChange={(event) => setDraft(event.target.value)}
        className="h-11 w-24 rounded-lg border border-slate-200 px-2 text-[0.8rem]"
      />
      <button
        type="button"
        disabled={disabled || !dirty}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, value: draft.trim(), strength: tag.strength, revision })}
        className="min-h-11 rounded-full bg-brand-600 px-3 text-[0.78rem] font-bold text-white disabled:opacity-40"
      >
        保存
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={`去掉${tag.label}`}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, clear: true, revision })}
        className="min-h-11 rounded-full border border-slate-200 px-3 text-[0.78rem] font-bold text-slate-700"
      >
        去掉
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, strength: nextStrength, revision })}
        className="min-h-11 rounded-full px-2 text-[0.72rem] font-semibold text-slate-500"
      >
        {tag.strength === "hard" ? "改为优先" : "改为必须"}
      </button>
    </div>
  );
}

export function ConstraintTags({ tags, probe, disabled, revision, onAction }: ConstraintTagsProps) {
  if (!tags.length && !probe?.count) return null;
  const hard = tags.filter((tag) => tag.strength === "hard");
  const prefer = tags.filter((tag) => tag.strength === "prefer");

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[0.78rem] font-bold text-slate-900">识别出的条件</p>
      <p className="text-[0.72rem] leading-relaxed text-slate-500">必须满足会用来筛选。优先考虑只影响排序。系统不会未经确认放宽必须满足的条件。</p>
      <div>
        <p className="text-[0.75rem] font-bold text-slate-800">必须满足</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {hard.length ? hard.map((tag) => (
            <TagEditor key={tag.field} tag={tag} disabled={disabled} revision={revision} onAction={onAction} />
          )) : <span className="text-[0.75rem] text-slate-500">还没有必须满足的条件。</span>}
        </div>
      </div>
      <div>
        <p className="text-[0.75rem] font-bold text-slate-800">优先考虑</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {prefer.length ? prefer.map((tag) => (
            <TagEditor key={tag.field} tag={tag} disabled={disabled} revision={revision} onAction={onAction} />
          )) : <span className="text-[0.75rem] text-slate-500">还没有优先考虑的条件。</span>}
        </div>
      </div>
      {probe?.needsConfirm ? (
        <div className="rounded-lg bg-white px-3 py-3">
          <p className="text-[0.8rem] font-semibold leading-relaxed text-slate-800">
            这两项分别放宽都会查到商品。请确认放宽哪一项。预算、宽度、品类和排除材质保持必须满足。
          </p>
          <div className="mt-2 space-y-2">
            {(probe.options || []).map((option) => (
              <button
                key={option.field}
                type="button"
                disabled={disabled}
                onClick={() => onAction({ action: "accept-probe", field: option.field, revision })}
                className="min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white"
              >
                放宽{option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
