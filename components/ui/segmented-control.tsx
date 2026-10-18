"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: { id: T; label: string }[];
  className?: string;
  /** Solid active tab is for the screen's mode switch. Soft is for secondary filters. */
  tone?: "soft" | "solid";
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  className,
  tone = "soft",
}: SegmentedControlProps<T>) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)} className={className}>
      <TabsList
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              tone === "solid" &&
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
            )}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
