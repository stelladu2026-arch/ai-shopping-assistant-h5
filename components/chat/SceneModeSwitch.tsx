"use client";

import type { AgentScene } from "@/types/agent";

interface SceneModeSwitchProps {
  value: AgentScene;
  onChange: (scene: AgentScene) => void;
}

export function SceneModeSwitch({ value, onChange }: SceneModeSwitchProps) {
  return (
    <div className="px-3 py-2">
      <div className="flex rounded-xl bg-white/90 p-0.5 shadow-sm ring-1 ring-slate-200/50">
        <button
          type="button"
          onClick={() => onChange("moments_marketing")}
          className={[
            "flex-1 rounded-[10px] py-2 text-center text-[0.78rem] font-semibold transition-colors duration-75",
            value === "moments_marketing"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 active:bg-slate-100",
          ].join(" ")}
        >
          朋友圈生成
        </button>
        <button
          type="button"
          onClick={() => onChange("store_rag_query")}
          className={[
            "flex-1 rounded-[10px] py-2 text-center text-[0.78rem] font-semibold transition-colors duration-75",
            value === "store_rag_query"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 active:bg-slate-100",
          ].join(" ")}
        >
          政策查询
        </button>
      </div>
    </div>
  );
}
