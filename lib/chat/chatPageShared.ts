import { consumeDemoChatFailureFlag } from "@/lib/demoChat";
import { postAgentChat } from "@/services/agent";
import type { AgentChatMessagePayload, MomentsOutputKind, MomentsGenerationInput } from "@/types/agent";
import { stringifyStructuredBlock } from "@/types/agent";
import type { ChatMessage } from "@/types/chat";

export const CHAT_FAIL_MSG = "请求失败，请稍后重试。";

export const defaultMomentsInput: MomentsGenerationInput = {
  outputKind: "rich",
  productName: "",
  sellingPoints: [],
  copyStyle: "warm",
  audience: "first_home",
};

export function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function continueGenerateCtaLabel(kind: MomentsOutputKind): string {
  if (kind === "copy_only") return "生成新文案";
  if (kind === "image_only") return "生成新配图";
  return "生成新图文";
}

export function parseMomentsOutputKind(v: string | null): MomentsOutputKind | null {
  if (v === "copy_only" || v === "image_only" || v === "rich") return v;
  return null;
}

/** 朋友圈配置仅放在 momentsSnapshot / 请求体，用户气泡不展示长文案 */
export function toAgentPayload(m: ChatMessage): AgentChatMessagePayload {
  if (m.role === "user") {
    return { role: "user", content: m.text ?? "" };
  }
  const parts: string[] = [];
  if (m.leadText) parts.push(m.leadText);
  if (m.structured) {
    parts.push(stringifyStructuredBlock(m.structured));
  }
  return { role: "assistant", content: parts.join("\n\n").trim() || " " };
}

async function agentChatRequest(options: Parameters<typeof postAgentChat>[0]) {
  if (consumeDemoChatFailureFlag()) {
    throw new Error("DEMO_FAIL");
  }
  return postAgentChat(options);
}

export { agentChatRequest };
