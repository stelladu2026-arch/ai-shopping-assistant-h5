import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: string;
  className?: string;
}

/** Repeated section label: short bar + quiet heading, used on every screen. */
export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <h2 className="text-[13px] font-semibold leading-none tracking-wide text-muted-foreground">{children}</h2>
    </div>
  );
}
