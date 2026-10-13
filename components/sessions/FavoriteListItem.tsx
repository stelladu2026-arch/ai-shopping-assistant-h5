"use client";

import { useRouter } from "next/navigation";
import type { FavoriteRecord } from "@/types/session";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

function productFacts(item: FavoriteRecord) {
  const block = item.structured;
  if (!block || block.scene !== "guide_turn") return null;
  return block.confirmedFacts || null;
}

interface FavoriteListItemProps {
  item: FavoriteRecord;
  group: "product" | "material";
  onOpen: (item: FavoriteRecord) => void;
  onRemove: (id: string) => void;
  onCopy: (plain: string) => void;
}

export function FavoriteListItem({ item, group, onOpen, onRemove, onCopy }: FavoriteListItemProps) {
  const router = useRouter();
  const facts = group === "product" ? productFacts(item) : null;
  const productId = facts?.id;

  return (
    <li className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-3 shadow-sm">
      <button type="button" onClick={() => onOpen(item)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-[0.88rem] font-semibold leading-snug text-slate-900">{facts?.name || item.title}</h3>
          <span className="shrink-0 text-[0.68rem] font-medium tabular-nums text-slate-400">{formatRelativeTime(item.createdAt)}</span>
        </div>
      </button>
      {facts ? (
        <div className="mt-2 space-y-0.5 text-[0.78rem] leading-relaxed text-slate-700">
          {productId ? <img src={`/products/${productId}.png`} alt={`${facts.name}按商品资料生成的示意图`} className="h-24 w-24 rounded-lg object-cover" /> : null}
          <p className="text-[0.72rem] text-slate-500">按商品资料生成的示意图</p>
          <p>型号 {facts.model}</p>
          <p>价格 {facts.price_cny} 元</p>
          <p>颜色 {facts.color} · 材质 {facts.material}</p>
          <p>尺寸 宽 {facts.width_cm} 厘米</p>
          {facts.style ? <p>风格 {facts.style}</p> : null}
        </div>
      ) : group === "material" ? (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-slate-600">查看这套素材，或复制后再发给顾客。</p>
      ) : (
        <p className="mt-2 text-[0.78rem] leading-relaxed text-slate-600">这条没有带上规格，不能直接生成。请回到选品重新收藏。</p>
      )}
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-2.5">
        {group === "product" && productId ? (
          <button
            type="button"
            onClick={() => {
              const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              router.push(`/chat?sessionId=${sid}&scene=moments_marketing&outputKind=rich&catalogProduct=${encodeURIComponent(productId)}`);
            }}
            className="min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white active:bg-brand-700"
          >
            用这件生成素材
          </button>
        ) : null}
        <div className="flex gap-2">
          {group === "material" ? (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex flex-1 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 py-2 text-[0.72rem] font-semibold text-slate-700 active:bg-slate-100"
            >
              查看
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onCopy(item.contentPlain)}
            className="flex flex-1 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 py-2 text-[0.72rem] font-semibold text-slate-700 active:bg-slate-100"
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded-lg px-3 py-2 text-[0.72rem] font-semibold text-slate-500 active:bg-slate-100"
          >
            取消收藏
          </button>
        </div>
      </div>
    </li>
  );
}
