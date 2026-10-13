"use client";

import type { AgentScene } from "@/types/agent";

interface SceneModeSwitchProps {
  value: AgentScene;
  onChange: (scene: AgentScene) => void;
}

export function SceneModeSwitch({ value, onChange }: SceneModeSwitchProps) {
  const items: { id: AgentScene; label: string }[] = [
    { id: "store_rag_query", label: "选品推荐" },
    { id: "moments_marketing", label: "素材生成" },
  ];
  return (
    <div className="px-3 py-2">
      <div className="flex rounded-xl bg-white/90 p-0.5 shadow-sm ring-1 ring-slate-200/50">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={[
              "flex-1 rounded-[10px] py-2 text-center text-[0.78rem] font-semibold transition-colors duration-75",
              value === item.id ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 active:bg-slate-100",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
