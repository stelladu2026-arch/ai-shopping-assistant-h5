"use client";

import { useRouter } from "next/navigation";
import type { FavoriteRecord } from "@/types/session";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <li>
      <Card className="px-4 py-3.5">
      <button type="button" onClick={() => onOpen(item)} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground">{facts?.name || item.title}</h3>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
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
      <Separator className="my-3" />
      <div className="flex flex-col gap-2">
        {group === "product" && productId ? (
          <Button
            type="button"
            onClick={() => {
              const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              router.push(`/chat?sessionId=${sid}&scene=moments_marketing&outputKind=rich&catalogProduct=${encodeURIComponent(productId)}`);
            }}
          >
            用这件生成素材
          </Button>
        ) : null}
        <div className="flex gap-2">
          {group === "material" ? (
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpen(item)}>
              查看
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onCopy(item.contentPlain)}>
            复制
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(item.id)}>
            取消收藏
          </Button>
        </div>
      </div>
      </Card>
    </li>
  );
}
