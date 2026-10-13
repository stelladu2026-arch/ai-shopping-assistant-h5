"use client";

import { useRef, useState } from "react";
import type { GuideTurnBlock } from "@/types/agent";
import { PhoneFrameOverlay } from "@/components/home/PhoneFrameOverlay";
import { DEGRADE_TEXT } from "@/lib/guide/limits";

type Product = GuideTurnBlock["products"][number];

const VISIBLE_LIMIT = 5;

function warrantyLine(reason: string) {
  if (/送装|质保/.test(reason)) return "送装和质保以资料原文为准。原文没写的，不编造成已包含。";
  return "资料没有写送装或质保年限。";
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[0.75rem] leading-snug">
      <dt className="w-8 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-800">{value}</dd>
    </div>
  );
}

function ProductFace({
  product,
  disabled,
  label,
  actionLabel,
  onConfirm,
  onOpenDetail,
}: {
  product: Product;
  disabled?: boolean;
  label: string | null;
  actionLabel: string | null;
  onConfirm: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <article data-product-card={product.id} className="overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surface ring-1 ring-slate-900/[0.04]">
      <div data-card-body="" className="px-3 pt-3">
        <div className="flex gap-3">
          <div className="w-28 shrink-0">
            {product.image ? (
              <div data-product-thumb="" className="h-28 w-28 overflow-hidden rounded-lg bg-slate-100">
                <img src={product.image} alt={`${product.name}按商品资料生成的示意图`} className="h-full w-full object-cover" />
              </div>
            ) : null}
            <button
              type="button"
              onClick={onOpenDetail}
              className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 text-[0.72rem] font-bold text-slate-800"
            >
              查看资料
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.95rem] font-bold leading-snug text-slate-900">{product.name}</h3>
            <p className="mt-0.5 text-[1.05rem] font-black tabular-nums text-brand-700">{product.price_cny} 元</p>
            <dl className="mt-1 space-y-0.5">
              <Fact label="型号" value={product.model} />
              <Fact label="颜色" value={product.color || ""} />
              <Fact label="材质" value={product.material || ""} />
              <Fact label="风格" value={product.style || ""} />
              <Fact label="尺寸" value={`宽 ${product.width_cm} 厘米`} />
              <Fact label="活动" value={product.promoUse || "没有可同时使用的活动"} />
            </dl>
          </div>
        </div>
        <div className="pb-3 pt-2">
          {label ? (
            <p className="min-h-11 text-[0.8rem] font-semibold leading-snug text-slate-600">{label}</p>
          ) : (
            <button
              type="button"
              data-confirm-button=""
              disabled={disabled}
              onClick={onConfirm}
              className="min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white active:bg-brand-700 disabled:opacity-40"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <PhoneFrameOverlay onBackdropClick={onClose} ariaLabel="资料">
      <div className="flex h-full flex-col bg-white">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-3 text-[0.85rem] font-bold text-slate-700">
            关闭
          </button>
          <h2 className="text-[0.95rem] font-bold text-slate-900">资料</h2>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[0.8rem] leading-relaxed text-slate-700">
          {product.image ? (
            <img src={product.image} alt={`${product.name}按商品资料生成的示意图`} className="h-56 w-56 rounded-lg object-cover" />
          ) : null}
          <p className="font-bold text-slate-900">{product.name}</p>
          <div>
            <h3 className="font-bold text-slate-900">示意图说明</h3>
            <p>按商品资料生成的示意图。不是已验收库存。</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">资料原文</h3>
            <p>{product.reason}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">送装 / 质保</h3>
            <p>{warrantyLine(product.reason)}</p>
            <p>送装：{DEGRADE_TEXT}。质保：{DEGRADE_TEXT}。</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">活动</h3>
            <p>{product.detailNote || product.promoUse || "没有可同时使用的活动"}</p>
          </div>
        </div>
      </div>
    </PhoneFrameOverlay>
  );
}

export function SelectionProducts({
  products,
  disabled,
  replacing,
  confirmedId,
  onConfirm,
}: {
  products: Product[];
  disabled?: boolean;
  replacing: boolean;
  confirmedId?: string | null;
  onConfirm: (productId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const shown = products.slice(0, VISIBLE_LIMIT);
  const more = products.slice(VISIBLE_LIMIT);
  const detail = products.find((item) => item.id === detailId) || null;

  function labelFor(product: Product) {
    if (product.failed) return "待核对。这件商品没有通过本轮约束核查，不能确认成已通过。";
    if (replacing && product.id === confirmedId) return "当前这件";
    return null;
  }

  function buttonLabel(product: Product) {
    if (labelFor(product)) return null;
    return replacing ? "换成这件商品" : "确认这件商品";
  }

  function face(product: Product) {
    return (
      <ProductFace
        product={product}
        disabled={disabled}
        label={labelFor(product)}
        actionLabel={buttonLabel(product)}
        onConfirm={() => {
          setMoreOpen(false);
          setDetailId(null);
          onConfirm(product.id);
        }}
        onOpenDetail={() => setDetailId(product.id)}
      />
    );
  }

  const strip = shown.length > 1 ? (
    <div data-product-strip="candidates" className="flex items-stretch gap-2">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between px-1 text-[0.75rem] font-semibold text-slate-500">
          <span>{index <= 0 ? "向左滑看下一件" : index >= shown.length - 1 ? "已经是最后一件" : "左右滑动"}</span>
          <span data-strip-index="">{index + 1}/{shown.length}</span>
        </div>
        <div
          ref={scrollerRef}
          onScroll={() => {
            const scroller = scrollerRef.current;
            if (!scroller) return;
            const cards = [...scroller.querySelectorAll<HTMLElement>("[data-product-card]")];
            const mid = scroller.getBoundingClientRect().left + scroller.clientWidth * 0.35;
            let best = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            cards.forEach((card, cardIndex) => {
              const dist = Math.abs(card.getBoundingClientRect().left - mid);
              if (dist < bestDist) {
                best = cardIndex;
                bestDist = dist;
              }
            });
            setIndex(best);
          }}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((product) => (
            <div key={product.id} className="w-[86%] shrink-0 snap-start">
              {face(product)}
            </div>
          ))}
        </div>
      </div>
      {more.length ? (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="mt-7 flex w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[0.78rem] font-bold text-slate-800 [writing-mode:vertical-rl]"
        >
          查看更多
        </button>
      ) : null}
    </div>
  ) : shown[0] ? (
    face(shown[0])
  ) : null;

  return (
    <>
      {strip}
      {moreOpen ? (
        <PhoneFrameOverlay onBackdropClick={() => setMoreOpen(false)} ariaLabel="查看更多">
          <div className="flex h-full flex-col bg-white">
            <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3">
              <button type="button" onClick={() => setMoreOpen(false)} className="min-h-11 rounded-xl px-3 text-[0.85rem] font-bold text-slate-700">
                返回
              </button>
              <h2 className="text-[0.95rem] font-bold text-slate-900">查看更多</h2>
            </header>
            <div data-more-list="" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              <p className="text-[0.78rem] leading-relaxed text-slate-600">前面 5 件在滑动区。这里是第 6 件及以后，仍可点选确认。</p>
              {more.map((product) => (
                <div key={product.id}>{face(product)}</div>
              ))}
            </div>
          </div>
        </PhoneFrameOverlay>
      ) : null}
      {detail ? <DetailSheet product={detail} onClose={() => setDetailId(null)} /> : null}
    </>
  );
}
