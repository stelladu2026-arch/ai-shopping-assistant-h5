"use client";

import { useMemo, useState } from "react";

export interface CatalogPickItem {
  id: string;
  name: string;
  model: string;
  category: string;
  price_cny: number;
  width_cm: number;
  color: string;
  material: string;
  style: string;
  image: string;
  promoNote: string;
}

interface CatalogPickerProps {
  items: CatalogPickItem[];
  disabled?: boolean;
  onPick: (productId: string) => void;
}

export function CatalogPicker({ items, disabled, onPick }: CatalogPickerProps) {
  const [category, setCategory] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );
  const shown = useMemo(() => {
    const needle = keyword.trim();
    return items.filter((item) => {
      if (category !== "全部" && item.category !== category) return false;
      if (!needle) return true;
      return [item.name, item.model, item.material, item.color, item.style, item.category].some((field) =>
        String(field || "").includes(needle),
      );
    });
  }, [items, category, keyword]);

  return (
    <section data-catalog="library" className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <h3 className="text-[0.9rem] font-bold text-slate-900">商品库</h3>
      <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-600">
        按商品资料生成的示意图，不是已验收库存。点一件即确认。名称、价格和规格回到素材页后不能手改。共 {items.length} 件。
      </p>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={[
              "shrink-0 rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold",
              category === item ? "border-brand-600 bg-brand-100 text-brand-950" : "border-slate-200 text-slate-600",
            ].join(" ")}
          >
            {item}
          </button>
        ))}
      </div>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="按名称、型号或材质缩小"
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[0.8rem] text-slate-900 outline-none"
      />
      <div className="mt-3 space-y-3">
        {shown.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200">
            <img src={item.image} alt={`${item.name}按商品资料生成的示意图`} className="aspect-square w-28 object-cover" />
            <div className="space-y-0.5 px-3 py-3 text-[0.78rem] leading-relaxed text-slate-700">
              <p className="text-[0.72rem] text-slate-500">按商品资料生成的示意图</p>
              <h4 className="text-[0.92rem] font-bold text-slate-900">{item.name}</h4>
              <p>型号 {item.model}</p>
              <p>材质 {item.material}</p>
              <p>颜色 {item.color}</p>
              <p>风格 {item.style}</p>
              <p>尺寸 宽 {item.width_cm} 厘米</p>
              <p className="text-[1rem] font-black text-brand-700">{item.price_cny} 元</p>
              <p className="font-semibold text-slate-800">{item.promoNote}</p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(item.id)}
                className="mt-2 min-h-11 w-full rounded-xl bg-brand-600 text-[0.85rem] font-bold text-white active:bg-brand-700 disabled:opacity-40"
              >
                用这件生成素材
              </button>
            </div>
          </article>
        ))}
        {shown.length === 0 ? <p className="text-[0.8rem] text-slate-500">没有符合这个范围的商品。下一步：换个品类或关键词。</p> : null}
      </div>
    </section>
  );
}
