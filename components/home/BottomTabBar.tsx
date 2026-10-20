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
  if (icon === "home") return "/guide";
  if (icon === "sessions") return "/sessions";
  return undefined;
};

const tabButtonClass =
  "relative flex h-14 w-full flex-col items-center justify-center gap-1 text-xs font-medium tracking-tight transition-colors duration-150 active:bg-accent";

export function BottomTabBar({ items }: BottomTabBarProps) {
  const cols = items.length <= 2 ? "grid-cols-2" : "grid-cols-4";
  return (
    <nav className="border-t border-border bg-card/95 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] shadow-tab backdrop-blur-xl">
      <ul className={`grid ${cols}`}>
        {items.map((item) => {
          const isActive = item.active;
          const href = tabHref(item.icon);
          const inner = (
            <>
              {isActive ? (
                <span
                  className="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary transition-all duration-200"
                  aria-hidden
                />
              ) : null}
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center transition",
                  isActive ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {iconMap[item.icon]}
              </span>
              <span
                className={
                  isActive ? "font-semibold text-primary" : "font-medium text-muted-foreground"
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
