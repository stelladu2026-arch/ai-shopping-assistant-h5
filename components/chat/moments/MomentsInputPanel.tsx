"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MOMENTS_AUDIENCES,
  MOMENTS_COPY_STYLES,
  MOMENTS_OUTPUT_MODES,
  MOMENTS_SELLING_POINTS,
} from "@/constants/chat-scenes";
import type { MomentsGenerationInput, MomentsOutputKind } from "@/types/agent";
import { CatalogPicker, type CatalogPickItem } from "@/components/chat/moments/CatalogPicker";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";

const PRESET_POINTS = new Set<string>(MOMENTS_SELLING_POINTS);
const MAX_SELLING_POINTS = 14;
const MAX_CUSTOM_LEN = 16;

const MOMENTS_CTA_LABEL: Record<MomentsOutputKind, string> = {
  copy_only: "生成文案",
  image_only: "生成配图",
  rich: "一键生成图文",
};

interface MomentsInputPanelProps {
  value: MomentsGenerationInput;
  onChange: (next: MomentsGenerationInput) => void;
  onGenerate: () => void;
  generateDisabled: boolean;
  /** 已确认商品事实。名称、价格和规格只读。要换件点更换商品。 */
  facts?: {
    name: string;
    model: string;
    price_cny: number;
    width_cm: number;
    color: string;
    material: string;
    style?: string;
    promoNote: string;
  } | null;
  /** 没有已确认商品时，在本页点选商品库。 */
  catalog?: CatalogPickItem[] | null;
  onPickProduct?: (productId: string) => void;
  /** 没有已确认商品，或还缺条件时的说明。不展示可编辑商品名。 */
  blockedMessage?: string | null;
  /** 发送中：按钮文案与禁用态由外层 controlling */
  loading?: boolean;
  /**
   * inline：对话流内嵌（含继续生成编辑卡片）
   * dock：对话页底栏固定区（与 BottomTabBar 衔接，不重复安全区）
   * sheet：半屏配置抽屉内
   */
  variant?: "inline" | "dock" | "sheet";
}

export function MomentsInputPanel({
  value,
  onChange,
  onGenerate,
  generateDisabled,
  loading = false,
  variant = "inline",
  facts = null,
  blockedMessage = null,
  catalog = null,
  onPickProduct,
}: MomentsInputPanelProps) {
  const [customDraft, setCustomDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const customSelected = useMemo(
    () => value.sellingPoints.filter((p) => !PRESET_POINTS.has(p)),
    [value.sellingPoints],
  );

  const togglePoint = (p: string) => {
    const set = new Set(value.sellingPoints);
    if (set.has(p)) set.delete(p);
    else if (set.size >= MAX_SELLING_POINTS) return;
    else set.add(p);
    onChange({ ...value, sellingPoints: [...set] });
  };

  const removePoint = useCallback(
    (p: string) => {
      onChange({
        ...value,
        sellingPoints: value.sellingPoints.filter((x) => x !== p),
      });
    },
    [onChange, value],
  );

  const addCustomPoint = useCallback(() => {
    const raw = customDraft.trim();
    if (!raw) return;
    const text = raw.slice(0, MAX_CUSTOM_LEN);
    if (value.sellingPoints.includes(text)) {
      setCustomDraft("");
      return;
    }
    if (value.sellingPoints.length >= MAX_SELLING_POINTS) return;
    if (PRESET_POINTS.has(text)) {
      if (!value.sellingPoints.includes(text)) {
        onChange({ ...value, sellingPoints: [...value.sellingPoints, text] });
      }
      setCustomDraft("");
      return;
    }
    onChange({ ...value, sellingPoints: [...value.sellingPoints, text] });
    setCustomDraft("");
  }, [customDraft, onChange, value]);

  const showCopyStyle = value.outputKind !== "image_only";

  return (
    <div
      id={variant === "inline" || variant === "dock" ? "moments-input-panel" : undefined}
      className={[
        "overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surface ring-1 ring-slate-900/[0.04]",
        variant === "dock" ? "mx-3 mt-1.5 mb-0"
        : variant === "inline" ? "mx-3 mt-2"
        : "mx-0 mt-0 rounded-xl",
      ].join(" ")}
    >
      <div className="border-b border-slate-100 px-3 py-2">
        <span className="text-[0.72rem] font-semibold text-slate-700">生成类型</span>
        <div className="mt-2 flex gap-1 rounded-xl bg-slate-100/80 p-0.5">
          {MOMENTS_OUTPUT_MODES.map((m) => {
            const on = value.outputKind === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ ...value, outputKind: m.id })}
                className={[
                  "flex-1 rounded-[10px] py-2 text-center text-[0.72rem] font-bold transition-colors duration-75",
                  on
                    ? "bg-brand-100 text-brand-950 shadow-sm ring-1 ring-brand-500/70"
                    : "text-slate-600 active:bg-white/60",
                ].join(" ")}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        {blockedMessage ? (
          <p className="rounded-xl bg-orange-50 px-3 py-3 text-[0.84rem] font-semibold leading-relaxed text-orange-900">{blockedMessage}</p>
        ) : null}
        {facts ? (
          <div data-readonly="product-facts" className="rounded-xl bg-slate-50 px-3 py-3">
            <p className="text-[0.72rem] font-semibold text-slate-500">名称、价格和规格不能手改。要换件，点「更换商品」。</p>
            <p className="mt-1 text-[0.95rem] font-bold text-slate-900">{facts.name}</p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-slate-700">型号 {facts.model}</p>
            <p className="text-[0.8rem] leading-relaxed text-slate-700">价格 {facts.price_cny} 元</p>
            <p className="text-[0.8rem] leading-relaxed text-slate-700">尺寸 宽 {facts.width_cm} 厘米</p>
            <p className="text-[0.8rem] leading-relaxed text-slate-700">颜色 {facts.color}</p>
            <p className="text-[0.8rem] leading-relaxed text-slate-700">材质 {facts.material}</p>
            {facts.style ? <p className="text-[0.8rem] leading-relaxed text-slate-700">风格 {facts.style}</p> : null}
            {facts.promoNote ? <p className="mt-1 text-[0.8rem] font-semibold leading-relaxed text-slate-800">{facts.promoNote}</p> : null}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 bg-white text-[0.85rem] font-bold text-slate-800"
            >
              更换商品
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white active:bg-brand-700"
          >
            选择商品
          </button>
        )}
        {pickerOpen && catalog && onPickProduct ? (
          <PhoneFrameOverlay onBackdropClick={() => setPickerOpen(false)} ariaLabel="选择商品">
            <div className="flex h-full flex-col bg-white">
              <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3">
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="min-h-11 rounded-xl px-3 text-[0.85rem] font-bold text-slate-700"
                >
                  返回
                </button>
                <h2 className="text-[0.95rem] font-bold text-slate-900">选择商品</h2>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CatalogPicker
                  items={catalog}
                  disabled={loading}
                  onPick={(productId) => {
                    onPickProduct(productId);
                    setPickerOpen(false);
                  }}
                />
              </div>
            </div>
          </PhoneFrameOverlay>
        ) : null}

        <div>
          <span className="mb-1.5 block text-[0.72rem] font-semibold text-slate-600">核心卖点（多选）</span>
          <div className="grid grid-cols-4 gap-1.5">
            {MOMENTS_SELLING_POINTS.map((p) => {
              const on = value.sellingPoints.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePoint(p)}
                  className={[
                    "min-h-[2.25rem] rounded-lg border px-1 py-1.5 text-center text-[0.65rem] font-semibold leading-tight transition-colors duration-75",
                    on
                      ? "border-brand-600 bg-brand-100 text-brand-950 shadow-sm"
                      : "border-slate-200/80 bg-white text-slate-600 active:bg-slate-100",
                  ].join(" ")}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {customSelected.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customSelected.map((p) => (
                <span
                  key={p}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-lg border border-brand-600 bg-brand-100 pl-2 pr-1 py-1 text-[0.68rem] font-semibold text-brand-950 shadow-sm"
                >
                  <span className="truncate">{p}</span>
                  <button
                    type="button"
                    onClick={() => removePoint(p)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-700 transition-colors duration-75 active:bg-brand-200/60"
                    aria-label={`删除${p}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex gap-1.5">
            <input
              type="text"
              value={customDraft}
              maxLength={MAX_CUSTOM_LEN}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomPoint();
                }
              }}
              placeholder="自填卖点，回车或添加"
              className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[0.78rem] font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={addCustomPoint}
              disabled={
                !customDraft.trim() || value.sellingPoints.length >= MAX_SELLING_POINTS
              }
              className="shrink-0 rounded-xl border border-brand-600 bg-brand-100 px-3 py-2 text-[0.75rem] font-bold text-brand-950 shadow-sm transition-colors duration-75 active:bg-brand-200 disabled:pointer-events-none disabled:opacity-40"
            >
              添加
            </button>
          </div>
        </div>

        {showCopyStyle ? (
          <div>
            <span className="mb-1.5 block text-[0.72rem] font-semibold text-slate-600">文案风格</span>
            <div className="grid grid-cols-2 gap-1.5">
              {MOMENTS_COPY_STYLES.map((s) => (
                <label
                  key={s.id}
                  className={[
                    "flex min-h-[2.5rem] cursor-pointer items-center gap-1.5 rounded-xl border px-2 py-2 text-[0.7rem] font-semibold transition-colors duration-75",
                    value.copyStyle === s.id
                      ? "border-brand-600 bg-brand-100 text-brand-950 shadow-sm"
                      : "border-slate-200/70 bg-white text-slate-700 active:bg-slate-50",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    className="h-3.5 w-3.5 shrink-0 accent-brand-600"
                    checked={value.copyStyle === s.id}
                    onChange={() => onChange({ ...value, copyStyle: s.id })}
                  />
                  <span className="min-w-0 flex-1 whitespace-nowrap leading-tight">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <span className="mb-1.5 block text-[0.72rem] font-semibold text-slate-600">目标客群</span>
          <div className="flex flex-wrap gap-1.5">
            {MOMENTS_AUDIENCES.map((a) => (
              <label
                key={a.id}
                className={[
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition-colors duration-75",
                  value.audience === a.id
                    ? "border-brand-600 bg-brand-100 text-brand-950 shadow-sm"
                    : "border-slate-200/80 bg-white text-slate-600 active:bg-slate-100",
                ].join(" ")}
              >
                <input
                  type="radio"
                  className="h-3.5 w-3.5 accent-brand-600"
                  checked={value.audience === a.id}
                  onChange={() => onChange({ ...value, audience: a.id })}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white px-3 py-3">
        <button
          type="button"
          disabled={generateDisabled || loading}
          onClick={onGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-[0.9rem] font-bold text-white shadow-md transition-colors duration-75 active:bg-brand-700 disabled:pointer-events-none disabled:opacity-45"
        >
          {loading ? (
            <>
              <span
                className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
                aria-hidden
              />
              <span>生成中…</span>
            </>
          ) : (
            MOMENTS_CTA_LABEL[value.outputKind]
          )}
        </button>
      </div>
    </div>
  );
}
