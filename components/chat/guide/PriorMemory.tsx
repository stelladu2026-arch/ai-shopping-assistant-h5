"use client";

import { useEffect, useState } from "react";

interface MemoryItem {
  id: string;
  key: string;
  value: string;
}

export function PriorMemory({ sessionId, revision = 0 }: { sessionId: string; revision?: number }) {
  const [items, setItems] = useState<MemoryItem[]>([]);

  const load = () => {
    void fetch("/api/guide/act")
      .then((response) => response.json())
      .then((payload) => {
        const book = payload.memory || {};
        const guide = (book.guide || []) as MemoryItem[];
        const sessions = book.sessions || {};
        const tasks = Object.values(sessions).flat() as MemoryItem[];
        setItems([...guide, ...tasks]);
      })
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, [sessionId, revision]);

  const remove = async (id: string) => {
    await fetch("/api/guide/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-memory", id, sessionId }),
    });
    load();
  };

  if (!items.length) return null;

  return (
    <section className="mx-3 mb-2 rounded-xl border border-slate-200/70 bg-white px-3 py-3">
      <p className="text-[0.78rem] font-bold text-slate-900">以往接待记下的内容</p>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">未验证，不会用来筛选商品。可以删除。</p>
      {items.map((item) => (
        <div key={item.id} className="mt-2 flex items-start justify-between gap-2">
          <p className="text-[0.75rem] leading-relaxed text-slate-800">
            {item.key}：{item.value}（未验证）
          </p>
          <button type="button" className="shrink-0 text-[0.75rem] font-semibold text-brand-700" onClick={() => void remove(item.id)}>
            删除
          </button>
        </div>
      ))}
    </section>
  );
}
