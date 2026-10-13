import { NextResponse } from "next/server";
import { guideAct, guideMaterial } from "@/lib/guide/session";
import type { AgentChatResponseBody, MomentsGenerationInput } from "@/types/agent";

export async function POST(req: Request) {
  const partial = (await req.json().catch(() => ({}))) as {
    scene?: string;
    messages?: { role: string; content: string }[];
    sessionId?: string;
    customerId?: string;
    text?: string;
    momentsInput?: MomentsGenerationInput;
  };
  if (partial.scene === "moments_marketing" && partial.momentsInput) {
    const structured = await guideMaterial(partial.momentsInput, partial.sessionId || partial.customerId);
    const failed = structured.cardTitle === "素材没有生成";
    const payload: AgentChatResponseBody = {
      messageId: `material_${Date.now()}`,
      done: true,
      leadText: failed ? structured.bodyText : structured.outputKind === "image_only" && !structured.generatedImageUrl
        ? (structured.imageSuggestion || "图片尚未生成，未调用生图接口。")
        : structured.outputKind === "rich" && !structured.generatedImageUrl
          ? "演示文案已准备，图片尚未生成。请先核对文案。"
          : "素材已生成，请核对后再复制发给顾客。",
      structured,
    };
    return NextResponse.json(payload);
  }
  const lastUser = [...(partial.messages ?? [])].reverse().find((item) => item.role === "user");
  const text = partial.text || lastUser?.content || "";
  const result = await guideAct({
    action: "turn",
    sessionId: partial.sessionId || partial.customerId,
    text,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  if (!("structured" in result)) return NextResponse.json({error:"unexpected_result"}, {status:500});
  const payload: AgentChatResponseBody = {
    messageId: `guide_${Date.now()}`,
    done: true,
    leadText: result.leadText || undefined,
    structured: result.structured as AgentChatResponseBody["structured"],
  };
  return NextResponse.json(payload);
}
