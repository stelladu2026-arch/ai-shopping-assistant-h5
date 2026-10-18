"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SessionCenterScope } from "@/types/store-insights";

interface SessionsScopeToggleProps {
  value: SessionCenterScope;
  onChange: (v: SessionCenterScope) => void;
}

export function SessionsScopeToggle({ value, onChange }: SessionsScopeToggleProps) {
  return (
    <div className="px-4 pt-4">
      <SegmentedControl
        value={value}
        onChange={onChange}
        items={[
          { id: "mine", label: "我的" },
          { id: "store", label: "本店" },
        ]}
      />
    </div>
  );
}
