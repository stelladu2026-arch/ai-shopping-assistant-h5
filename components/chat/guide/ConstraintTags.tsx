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

function rowCopy(field: string) {
  if (field === "budget_max_cny") return { name: "预算", unit: "元" };
  if (field === "width_max_cm") return { name: "宽度", unit: "厘米" };
  if (field === "category") return { name: "品类", unit: "" };
  if (field === "color") return { name: "颜色", unit: "" };
  if (field === "exclude_material") return { name: "不要", unit: "" };
  if (field === "material") return { name: "材质", unit: "" };
  if (field === "style") return { name: "风格", unit: "" };
  return { name: "条件", unit: "" };
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
  const { name, unit } = rowCopy(tag.field);
  const [draft, setDraft] = useState(String(tag.value));
  useEffect(() => {
    setDraft(String(tag.value));
  }, [tag.field, tag.value]);
  const dirty = draft.trim() !== "" && draft.trim() !== String(tag.value);
  const phrase = `${name} ${draft.trim()}${unit}`;

  return (
    <div data-constraint-field={tag.field} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2">
      <span className="shrink-0 text-[0.82rem] font-semibold text-slate-900">{name}</span>
      <Input
        value={draft}
        disabled={disabled}
        inputMode={numeric ? "numeric" : "text"}
        aria-label={`修改${phrase}`}
        onChange={(event) => setDraft(event.target.value)}
        className="h-11 min-w-0 flex-1 px-2 text-[0.9rem]"
      />
      {unit ? <span className="shrink-0 text-[0.78rem] text-slate-500">{unit}</span> : null}
      {tag.strength === "prefer" ? <span className="shrink-0 text-[0.68rem] font-medium text-slate-400">可放宽</span> : null}
      <Button
        type="button"
        size="sm"
        disabled={disabled || !dirty}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, value: draft.trim(), revision })}
        className="h-11 shrink-0 px-3"
      >
        保存
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={`去掉${phrase}`}
        onClick={() => onAction({ action: "edit-constraint", field: tag.field, clear: true, revision })}
        className="h-11 shrink-0 px-3"
      >
        去掉
      </Button>
    </div>
  );
}

export function ConstraintTags({ tags, probe, disabled, revision, onAction }: ConstraintTagsProps) {
  if (!tags.length && !probe?.needsConfirm) return null;

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[0.78rem] font-bold text-slate-900">识别出的条件</p>
      {tags.length ? (
        <div className="space-y-2">
          {tags.map((tag) => (
            <TagEditor key={tag.field} tag={tag} disabled={disabled} revision={revision} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {probe?.needsConfirm ? (
        <div className="rounded-lg bg-white px-3 py-3">
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
