"use client";

import { useEffect, useState } from "react";

interface MemoryItem {
  id: string;
  key: string;
  value: string;
}

export function PriorMemory({ sessionId, revision = 0 }: { sessionId: string; revision?: number }) {
  const [guide, setGuide] = useState<MemoryItem[]>([]);
  const [current, setCurrent] = useState<MemoryItem[]>([]);
  const [prior, setPrior] = useState<MemoryItem[]>([]);

  const load = () => {
    void fetch("/api/guide/act")
      .then((response) => response.json())
      .then((payload) => {
        const book = payload.memory || {};
        const sessions = (book.sessions || {}) as Record<string, MemoryItem[]>;
        setGuide((book.guide || []) as MemoryItem[]);
        setCurrent(sessions[sessionId] || []);
        setPrior(
          Object.entries(sessions)
            .filter(([id]) => id !== sessionId)
            .flatMap(([, items]) => items || []),
        );
      })
      .catch(() => {
        setGuide([]);
        setCurrent([]);
        setPrior([]);
      });
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

  if (!guide.length && !current.length && !prior.length) return null;

  const groups = [
    ["导购偏好", guide],
    ["这次接待记下的内容", current],
    ["其他接待记下的内容", prior],
  ] as const;

  return (
    <section className="mx-3 mb-2 rounded-xl border border-slate-200/70 bg-white px-3 py-3">
      <p className="text-[0.78rem] font-bold text-slate-900">记下的内容</p>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">未验证，不会用来筛选商品。可以删除。</p>
      {groups.map(([label, items]) =>
        items.length ? (
          <div key={label} className="mt-2">
            <p className="text-[0.72rem] font-semibold text-slate-500">{label}</p>
            {items.map((item) => (
              <div key={item.id} className="mt-1 flex items-start justify-between gap-2">
                <p className="text-[0.75rem] leading-relaxed text-slate-800">
                  {item.key}：{item.value}（未验证）
                </p>
                <button type="button" className="shrink-0 text-[0.75rem] font-semibold text-brand-700" onClick={() => void remove(item.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </section>
  );
}
