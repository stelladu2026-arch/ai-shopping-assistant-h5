"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";

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
  return <SegmentedControl value={value} onChange={onChange} items={tabs} />;
}
