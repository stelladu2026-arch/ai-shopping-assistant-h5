"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function fieldName(field: string) {
  if (field === "budget_max_cny") return "预算";
  if (field === "width_max_cm") return "尺寸";
  if (field === "category") return "品类";
  if (field === "color") return "颜色";
  if (field === "exclude_material") return "不要";
  if (field === "material") return "材质";
  if (field === "style") return "风格";
  return "条件";
}

function inputWidth(value: string, numeric: boolean) {
  const text = value.length ? value : numeric ? "0000" : "字";
  let units = 0;
  for (const char of text) units += char.charCodeAt(0) > 255 ? 2 : 1;
  const chars = Math.min(12, Math.max(numeric ? 4 : 2, units));
  return `calc(${chars}ch + 1rem)`;
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
  const name = fieldName(tag.field);
  const inputId = `constraint-${tag.field}`;
  const [draft, setDraft] = useState(String(tag.value));
  useEffect(() => {
    setDraft(String(tag.value));
  }, [tag.field, tag.value]);
  const dirty = draft.trim() !== "" && draft.trim() !== String(tag.value);

  return (
    <div data-constraint-field={tag.field} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white py-0.5 pl-1.5 pr-0.5">
      <label htmlFor={inputId} className="shrink-0 text-xs font-semibold text-slate-900">{name}</label>
      <Input
        id={inputId}
        value={draft}
        disabled={disabled}
        inputMode={numeric ? "numeric" : "text"}
        aria-label={name}
        onChange={(event) => setDraft(event.target.value)}
        style={{ width: inputWidth(draft, numeric) }}
        className="h-[34px] w-auto min-w-[3.25rem] max-w-[9rem] shrink rounded-md px-1.5 text-[13px] shadow-none"
      />
      {tag.strength === "prefer" ? <span className="shrink-0 text-[0.68rem] font-medium text-slate-400">可放宽</span> : null}
      <Button
        type="button"
        size="sm"
        disabled={disabled || !dirty}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, value: draft.trim(), revision })}
        className="h-[34px] shrink-0 rounded-md px-2 text-xs"
      >
        保存
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={`去掉${name}`}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, clear: true, revision })}
        className="h-[34px] shrink-0 rounded-md px-2 text-xs"
      >
        去掉
      </Button>
    </div>
  );
}

export function ConstraintTags({ tags, probe, disabled, revision, onAction }: ConstraintTagsProps) {
  if (!tags.length && !probe?.needsConfirm) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
      <p className="text-xs font-bold text-slate-900">识别出的条件</p>
      {tags.length ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <TagEditor key={tag.field} tag={tag} disabled={disabled} revision={revision} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {probe?.needsConfirm ? (
        <div className="mt-1.5 rounded-lg bg-white px-3 py-3">
          <p className="text-[0.8rem] font-semibold leading-relaxed text-slate-800">
            放宽下面任一项都能查到商品。请点一项继续。
          </p>
          <div className="mt-2 space-y-2">
            {(probe.options || []).map((option) => (
              <Button
                key={option.field}
                type="button"
                disabled={disabled}
                onClick={() => onAction({ action: "accept-probe", field: option.field, revision })}
                className="h-11 w-full"
              >
                放宽{option.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
