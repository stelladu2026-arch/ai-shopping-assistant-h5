"use client";

import type { GuideTurnBlock } from "@/types/agent";
import { ConstraintTags } from "@/components/chat/guide/ConstraintTags";
import { GuideProcess } from "@/components/chat/guide/GuideProcess";
import { SelectionProducts } from "@/components/chat/guide/ProductStrip";

interface GuideTurnCardProps {
  data: GuideTurnBlock;
  disabled?: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

export function GuideTurnCard({ data, disabled, onAction }: GuideTurnCardProps) {
  const constraints = data.constraints;
  const lines = [
    constraints?.budget_max_cny != null ? `预算${constraints.budget_max_cny}元` : "",
    constraints?.width_max_cm != null ? `宽度${constraints.width_max_cm}厘米` : "",
    constraints?.category ? `品类${constraints.category}` : "",
    constraints?.color ? `颜色${constraints.color}` : "",
    constraints?.exclude_material ? `排除${constraints.exclude_material}` : "",
  ].filter(Boolean);

  const replacing = Boolean(data.offerSwitch && data.confirmedId);
  const facts = data.confirmedFacts;

  return (
    <div className="mt-2 space-y-3">
      <ConstraintTags
        tags={data.constraintTags || []}
        probe={data.probe}
        disabled={disabled}
        revision={data.revision}
        onAction={onAction}
      />
      {data.pendingQuestion ? (
        <p className="rounded-xl bg-orange-50 px-3 py-3 text-[0.84rem] font-semibold leading-relaxed text-orange-900">{data.pendingQuestion}</p>
      ) : null}
      <SelectionProducts
        products={data.products}
        disabled={disabled}
        replacing={replacing}
        confirmedId={data.confirmedId}
        onConfirm={(productId) => onAction({ action: "confirm", productId, revision: data.revision })}
      />

      {data.products.length ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ action: "rerun-research" })}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white text-[0.85rem] font-bold text-slate-800"
        >
          重新筛选
        </button>
      ) : null}

      {data.basis ? <p className="px-1 text-[0.78rem] leading-relaxed text-slate-600">{data.basis}</p> : null}

      {data.confirmedName ? (
        <article className="rounded-saas border border-slate-200/70 bg-white px-3 py-3 shadow-surface">
          <h3 className="text-[0.9rem] font-bold text-slate-900">已选定 {data.confirmedName}</h3>
          {facts ? (
            <div className="mt-2 space-y-0.5 text-[0.8rem] leading-relaxed text-slate-700">
              <p>型号 {facts.model}</p>
              <p>价格 {facts.price_cny} 元</p>
              <p>尺寸 宽 {facts.width_cm} 厘米</p>
              <p>颜色 {facts.color}</p>
              <p>材质 {facts.material}</p>
            </div>
          ) : null}
          <p className="mt-2 text-[0.84rem] leading-relaxed text-slate-800">下一步生成可发给顾客的素材。生成后复制你要用的那一套。</p>
          {data.promoPlan?.note ? (
            <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed text-slate-800">{data.promoPlan.note}</p>
          ) : null}
          {data.material?.pendingReview ? (
            <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed text-orange-800">待核对。{data.material.reviewNote || "上一套文案和配图还不能直接用。下一步：点重新生成素材。"}</p>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction({ action: "open-material", productName: data.confirmedName, outputKind: "rich" })}
            className="mt-3 min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white active:bg-brand-700 disabled:opacity-40"
          >
            去生成素材
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction({ action: "favorite", kind: "product" })}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 text-[0.85rem] font-bold text-slate-800"
          >
            收藏这件商品
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction({ action: "rerun-research" })}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 text-[0.85rem] font-bold text-slate-800"
          >
            重新筛选
          </button>
        </article>
      ) : null}

      <GuideProcess process={data.process} reflection={data.reflection} />

      {lines.length || data.confirmedName ? (
        <div className="flex flex-wrap gap-2">
          {lines.length ? (
            <button
              type="button"
              id="remember-constraints"
              disabled={disabled}
              onClick={() => onAction({ action: "remember", scope: "customer", key: "本次约束", value: lines.join("，") })}
              className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-[0.78rem] font-semibold text-slate-700"
            >
              记住这次约束
            </button>
          ) : null}
          {data.confirmedName ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction({ action: "remember", scope: "customer", key: "已确认商品", value: data.confirmedName })}
              className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-[0.78rem] font-semibold text-slate-700"
            >
              记住已确认商品
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
