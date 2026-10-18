"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { AgentScene } from "@/types/agent";

interface SceneModeSwitchProps {
  value: AgentScene;
  onChange: (scene: AgentScene) => void;
}

export function SceneModeSwitch({ value, onChange }: SceneModeSwitchProps) {
  return (
    <div className="px-4 py-3">
      <SegmentedControl
        tone="solid"
        value={value}
        onChange={onChange}
        items={[
          { id: "store_rag_query", label: "选品推荐" },
          { id: "moments_marketing", label: "素材生成" },
        ]}
      />
    </div>
  );
}
