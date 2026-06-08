"use client";

import type { SessionCenterScope } from "@/types/store-insights";

interface SessionsScopeToggleProps {
  value: SessionCenterScope;
  onChange: (v: SessionCenterScope) => void;
}

export function SessionsScopeToggle({ value, onChange }: SessionsScopeToggleProps) {
  return (
    <div className="px-3 pt-2">
      <div className="flex rounded-xl border border-slate-200/70 bg-white p-0.5 shadow-sm">
        {(
          [
            { id: "mine" as const, label: "我的" },
            { id: "store" as const, label: "本店" },
          ] as const
        ).map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={[
                "relative flex-1 rounded-[0.65rem] py-2 text-center text-[0.78rem] font-semibold transition-colors duration-75",
                active ? "text-brand-800" : "text-slate-500 active:bg-slate-50",
              ].join(" ")}
            >
              {active ? (
                <span
                  className="absolute inset-0 rounded-[0.65rem] bg-brand-50 ring-1 ring-brand-200/60"
                  aria-hidden
                />
              ) : null}
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
