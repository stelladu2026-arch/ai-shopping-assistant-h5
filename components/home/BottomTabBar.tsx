import type { ReactElement } from "react";
import Link from "next/link";
import type { BottomTabItem, TabIcon } from "@/types/home";

interface BottomTabBarProps {
  items: BottomTabItem[];
}

const iconMap: Record<TabIcon, ReactElement> = {
  home: (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 10.5L12 4L20 10.5V19C20 19.5523 19.5523 20 19 20H15V14H9V20H5C4.44772 20 4 19.5523 4 19V10.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ),
  /** 会话中心：列表/汇总语义（非即时聊天气泡） */
  sessions: (
    <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </svg>
  ),
};

const tabHref = (icon: TabIcon): string | undefined => {
  if (icon === "home") return "/";
  if (icon === "sessions") return "/sessions";
  return undefined;
};

const tabButtonClass =
  "relative flex w-full flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold tracking-tight transition-colors duration-75 active:bg-slate-100/90";

export function BottomTabBar({ items }: BottomTabBarProps) {
  const cols = items.length <= 2 ? "grid-cols-2" : "grid-cols-4";
  return (
    <nav className="border-t border-slate-200/45 bg-white/75 pb-[max(0.4rem,env(safe-area-inset-bottom,0.25rem))] pt-0.5 shadow-tab backdrop-blur-xl">
      <ul className={`grid ${cols}`}>
        {items.map((item) => {
          const isActive = item.active;
          const href = tabHref(item.icon);
          const inner = (
            <>
              {isActive ? (
                <span
                  className="absolute bottom-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-brand-600"
                  aria-hidden
                />
              ) : null}
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center transition",
                  isActive ? "text-brand-700" : "text-slate-400",
                ].join(" ")}
              >
                {iconMap[item.icon]}
              </span>
              <span
                className={
                  isActive ? "font-semibold text-brand-700" : "font-medium text-slate-500"
                }
              >
                {item.label}
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {href ? (
                <Link href={href} className={tabButtonClass}>
                  {inner}
                </Link>
              ) : (
                <button type="button" className={tabButtonClass}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
