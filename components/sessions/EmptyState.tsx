"use client";

import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: "inbox" | "star";
  action?: { label: string; href: string };
}

export function EmptyState({ title, description, icon = "inbox", action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-300 shadow-sm"
        aria-hidden
      >
        {icon === "star" ? (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 00-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 00-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 00.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        ) : (
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4"
            />
          </svg>
        )}
      </span>
      <p className="text-[0.9rem] font-semibold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-2 max-w-[16rem] text-[0.78rem] font-medium leading-relaxed text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-[0.8rem] font-semibold text-white shadow-sm active:bg-brand-700"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
