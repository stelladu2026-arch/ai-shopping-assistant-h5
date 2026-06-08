"use client";

import { RAG_PRESET_QUESTIONS } from "@/constants/chat-scenes";

interface RagQuickAskBarProps {
  onPickPreset: (text: string) => void;
}

export function RagQuickAskBar({ onPickPreset }: RagQuickAskBarProps) {
  return (
    <div className="bg-white px-2 py-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {RAG_PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPickPreset(q)}
            className="max-w-[11rem] shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-left text-[0.75rem] font-semibold leading-snug text-slate-700 shadow-sm transition-colors duration-75 active:bg-slate-100"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
