import { fetchJsonResponse } from "../lib/request-deadline";
import type { AgentChatRequestBody, AgentChatResponseBody } from "@/types/agent";

export async function postAgentChat(
  body: AgentChatRequestBody,
): Promise<AgentChatResponseBody> {
  const { response: res, payload } = await fetchJsonResponse<AgentChatResponseBody>("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, body.scene === "moments_marketing" ? 150000 : 60000);
  if (!res.ok) {
    throw new Error(`Agent chat failed: ${res.status}`);
  }
  return payload;
}
