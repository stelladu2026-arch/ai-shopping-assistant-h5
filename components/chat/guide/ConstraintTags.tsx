"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface Draft {
  field: string;
  name: string;
  value: string;
  original: string;
  numeric: boolean;
  relaxable: boolean;
  removed: boolean;
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

function summaryText(tags: ConstraintTag[]) {
  return tags.map((tag) => `${fieldName(tag.field)} ${tag.value}`).join(" · ");
}

function draftsFrom(tags: ConstraintTag[]): Draft[] {
  return tags.map((tag) => ({
    field: tag.field,
    name: fieldName(tag.field),
    value: String(tag.value),
    original: String(tag.value),
    numeric: tag.field === "budget_max_cny" || tag.field === "width_max_cm",
    relaxable: tag.strength === "prefer",
    removed: false,
  }));
}

export function ConstraintTags({ tags, probe, disabled, revision, onAction }: ConstraintTagsProps) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);
  if (!tags.length && !probe?.needsConfirm) return null;

  function openEditor() {
    setDrafts(draftsFrom(tags));
    setError("");
    setOpen(true);
  }

  function updateDraft(field: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((item) => (item.field === field ? { ...item, ...patch } : item)));
  }

  function save() {
    const changes: Array<{ field: string; value?: string; clear?: boolean }> = [];
    for (const draft of drafts) {
      if (draft.removed) {
        changes.push({ field: draft.field, clear: true });
        continue;
      }
      const value = draft.value.trim();
      if (!value) {
        setError("请填写每一项，或点去掉。");
        return;
      }
      if (draft.numeric && !Number.isFinite(Number(value))) {
        setError("预算和尺寸请填数字。");
        return;
      }
      if (value !== draft.original) changes.push({ field: draft.field, value });
    }
    if (changes.length) onAction({ action: "edit-constraint", changes, revision });
    setOpen(false);
  }

  return (
    <section className="space-y-2">
      {tags.length ? (
        <div data-constraint-strip className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p data-constraint-summary className="m-0 text-[13px] font-medium leading-5 text-slate-800">{summaryText(tags)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={openEditor}
            className="h-7 rounded-full px-2.5 text-xs"
          >
            编辑
          </Button>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-3 p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            firstInput.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>识别出的条件</DialogTitle>
            <DialogDescription className="sr-only">修改已读取的条件，保存后一起重新筛选。</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {drafts.map((draft, index) => (
              <div key={draft.field} data-constraint-field={draft.field} className={draft.removed ? "flex items-center gap-1.5 opacity-45" : "flex items-center gap-1.5"}>
                <label htmlFor={`constraint-edit-${draft.field}`} className="w-8 shrink-0 text-xs font-semibold text-slate-900">{draft.name}</label>
                <Input
                  ref={index === 0 ? firstInput : undefined}
                  id={`constraint-edit-${draft.field}`}
                  value={draft.value}
                  disabled={disabled || draft.removed}
                  inputMode={draft.numeric ? "numeric" : "text"}
                  aria-label={draft.name}
                  onChange={(event) => updateDraft(draft.field, { value: event.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-lg px-2 text-[13px] shadow-none"
                />
                {draft.relaxable ? <span className="shrink-0 text-[11px] font-medium text-slate-400">可放宽</span> : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label={`${draft.removed ? "撤销" : "去掉"}${draft.name}`}
                  onClick={() => updateDraft(draft.field, { removed: !draft.removed })}
                  className="h-9 shrink-0 rounded-lg px-2 text-xs"
                >
                  {draft.removed ? "撤销" : "去掉"}
                </Button>
              </div>
            ))}
          </div>
          {error ? <p className="text-xs font-medium text-orange-800">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="h-9 px-3 text-xs">
              取消
            </Button>
            <Button type="button" size="sm" disabled={disabled} onClick={save} className="h-9 px-3 text-xs">
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {probe?.needsConfirm ? (
        <div className="rounded-lg bg-slate-50 px-3 py-3">
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
