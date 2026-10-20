"use client";

import { useEffect, useState } from "react";

interface MemoryItem {
  id: string;
  key: string;
  value: string;
}

export function MemoryPanel() {
  const [guide, setGuide] = useState<MemoryItem[]>([]);
  const [tasks, setTasks] = useState<MemoryItem[]>([]);

  const load = () => {
    void fetch("/api/guide/act")
      .then((response) => response.json())
      .then((payload) => {
        const book = payload.memory || {};
        setGuide(book.guide || []);
        const grouped = book.sessions || {};
        setTasks(Object.values(grouped).flat() as MemoryItem[]);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    await fetch("/api/guide/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-memory", id, sessionId: "session" }),
    });
    load();
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3">
      <p className="text-[0.78rem] font-bold text-slate-800">这次接待记下的内容</p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-slate-500">未验证，可删除。不会自动变成选品规则。</p>
      {[...guide, ...tasks].length === 0 ? <p className="mt-2 text-[0.75rem] text-slate-500">还没有记住的内容</p> : null}
      {[...guide, ...tasks].map((item) => (
        <div key={item.id} className="mt-1 flex min-h-11 items-center justify-between gap-2">
          <span className="text-[0.75rem] text-slate-800">{item.key}：{item.value}（未验证）</span>
          <button type="button" className="shrink-0 text-[0.75rem] font-semibold text-brand-700" onClick={() => void remove(item.id)}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
}
