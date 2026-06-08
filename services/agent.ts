import type { AgentChatRequestBody, AgentChatResponseBody } from "@/types/agent";

export async function postAgentChat(
  body: AgentChatRequestBody,
): Promise<AgentChatResponseBody> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `Agent chat failed: ${res.status}`);
  }
  return res.json() as Promise<AgentChatResponseBody>;
}
