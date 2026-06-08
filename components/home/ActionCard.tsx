"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { MomentsOutputKind } from "@/types/agent";
import type { QuickActionData, QuickActionIcon } from "@/types/home";
import { ChevronRightIcon } from "@/components/icons/ChevronRightIcon";

interface ActionCardProps {
  item: QuickActionData;
}

/** 首页 mock 子入口 id → 会话页 outputKind */
const MARKETING_SUB_TO_KIND: Record<string, MomentsOutputKind> = {
  "generate-copy": "copy_only",
  "generate-image": "image_only",
  "generate-rich-content": "rich",
};

const iconMap: Record<QuickActionIcon, ReactElement> = {
  product: (
    <svg aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 7.5L12 4L18 7.5M6 7.5V16.5L12 20M6 7.5L12 11M18 7.5V16.5L12 20M18 7.5L12 11M12 11V20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ),
  campaign: (
    <svg aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 10.5L14.5 5V19L4 13.5V10.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.5 8.5H17C18.3807 8.5 19.5 9.61929 19.5 11V13C19.5 14.3807 18.3807 15.5 17 15.5H14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  ),
  copy: (
    <svg aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 7H16M8 11H16M8 15H13M7 4H17C18.1046 4 19 4.89543 19 6V18C19 19.1046 18.1046 20 17 20H7C5.89543 20 5 19.1046 5 18V6C5 4.89543 5.89543 4 7 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ),
  image: (
    <svg aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 6.5C5 5.67157 5.67157 5 6.5 5H17.5C18.3284 5 19 5.67157 19 6.5V17.5C19 18.3284 18.3284 19 17.5 19H6.5C5.67157 19 5 18.3284 5 17.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 15L10.5 12.5L13 15L15.5 10.5L19 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="9" r="1.25" fill="currentColor" />
    </svg>
  ),
  marketing: (
    <svg aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 18.5H18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.5 15L10.5 11L13 13.5L16.5 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M15 8.5H18V11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <rect
        x="4.75"
        y="4.75"
        width="14.5"
        height="14.5"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
};

/** 首页入口 id → 会话页「政策查询」场景（新会话） */
function navigateToPolicyQuery(router: ReturnType<typeof useRouter>) {
  const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const q = new URLSearchParams({
    sessionId: sid,
    scene: "store_rag_query",
  });
  router.push(`/chat?${q.toString()}`);
}

function MarketingSubActionButtons({ subs }: { subs: NonNullable<QuickActionData["subActions"]> }) {
  const router = useRouter();
  return (
    <div className="mt-2 grid w-full grid-cols-3 gap-1.5">
      {subs.map((sub) => (
        <button
          key={sub.id}
          type="button"
          onClick={() => {
            const kind = MARKETING_SUB_TO_KIND[sub.id];
            if (!kind) return;
            const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const q = new URLSearchParams({
              sessionId: sid,
              scene: "moments_marketing",
              outputKind: kind,
            });
            router.push(`/chat?${q.toString()}`);
          }}
          className="flex min-h-[2.25rem] min-w-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200/90 bg-white px-1 py-1.5 text-center text-[10px] font-semibold leading-tight text-brand-900/90 shadow-sm transition-[background-color,border-color,transform] duration-75 hover:border-brand-300/80 hover:bg-brand-50/90 active:scale-[0.98] active:bg-brand-50 sm:text-[11px]"
        >
          {sub.label}
        </button>
      ))}
    </div>
  );
}

function RowBody({ item, hasSubActions }: { item: QuickActionData; hasSubActions: boolean }) {
  return (
    <>
      <span
        className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-slate-200/75 bg-slate-100 text-brand-800 shadow-sm sm:h-[4.75rem] sm:w-[4.75rem]"
        aria-hidden
      >
        {iconMap[item.icon]}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <span className="block text-[0.95rem] font-semibold leading-snug text-slate-900 sm:text-base">
            {item.title}
          </span>
          {item.description?.trim() ? (
            <p className="mt-1 line-clamp-2 text-[0.8rem] leading-relaxed text-slate-500 sm:text-sm">
              {item.description}
            </p>
          ) : null}
          {hasSubActions ? (
            <MarketingSubActionButtons subs={item.subActions!} />
          ) : null}
        </div>
        <ChevronRightIcon />
      </div>
    </>
  );
}

export function ActionCard({ item }: ActionCardProps) {
  const router = useRouter();
  const hasSubActions = Boolean(item.subActions?.length);

  const rowInteractive =
    "flex w-full cursor-pointer items-center gap-3.5 border-b border-slate-200/40 bg-white px-5 py-4 text-left transition-[background-color] duration-150 last:border-b-0 hover:bg-slate-50 active:bg-slate-100/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/45";

  const rowGrouped =
    "flex w-full cursor-default items-center gap-3.5 border-b border-slate-200/40 bg-white px-5 py-4 text-left transition-[background-color] duration-150 last:border-b-0 hover:bg-slate-50/90";

  const rowClassName = hasSubActions ? rowGrouped : rowInteractive;

  if (hasSubActions) {
    return (
      <div className={rowClassName} role="group" aria-label={`${item.title}，点击下方选项进入会话`}>
        <RowBody item={item} hasSubActions />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={rowClassName}
      onClick={() => {
        if (item.id === "policy-query") navigateToPolicyQuery(router);
      }}
    >
      <RowBody item={item} hasSubActions={false} />
    </button>
  );
}
