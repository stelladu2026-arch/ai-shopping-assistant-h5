"use client";

import { RAG_PRESET_QUESTIONS } from "@/constants/chat-scenes";

interface RagQuickAskBarProps {
  onPickPreset: (text: string) => void;
}

export function RagQuickAskBar({ onPickPreset }: RagQuickAskBarProps) {
  return (
    <div className="w-full min-w-0 bg-card px-4 pb-1 pt-2">
      <div className="flex flex-wrap gap-2">
        {RAG_PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPickPreset(q)}
            className="max-w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-xs font-semibold leading-snug text-foreground transition-colors duration-150 active:bg-accent"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
