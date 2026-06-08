import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-saas border border-slate-200/50 bg-white/80 shadow-surface ring-1 ring-slate-900/[0.03] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
