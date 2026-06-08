"use client";

export type SessionHubTab = "recent" | "favorites";

interface SessionTabsProps {
  value: SessionHubTab;
  onChange: (v: SessionHubTab) => void;
}

const tabs: { id: SessionHubTab; label: string }[] = [
  { id: "recent", label: "最近会话" },
  { id: "favorites", label: "收藏" },
];

export function SessionTabs({ value, onChange }: SessionTabsProps) {
  return (
    <div className="px-3 pt-1">
      <div className="flex rounded-xl border border-slate-200/70 bg-white p-0.5 shadow-sm">
        {tabs.map((t) => {
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
