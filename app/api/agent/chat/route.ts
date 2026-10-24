import { NextResponse } from "next/server";
import { guideAct, guideMaterial } from "@/lib/guide/session";
import type { AgentChatResponseBody, GuideTurnBlock, MomentsGenerationInput } from "@/types/agent";

export async function POST(req: Request) {
  const partial = (await req.json().catch(() => ({}))) as {
    scene?: string;
    messages?: { role: string; content: string }[];
    sessionId?: string;
    customerId?: string;
    text?: string;
    momentsInput?: MomentsGenerationInput;
    newPiece?: boolean;
    pieceId?: string;
  };
  if (partial.scene === "moments_marketing" && partial.momentsInput) {
    const structured = await guideMaterial(partial.momentsInput, partial.sessionId || partial.customerId, {
      newPiece: partial.newPiece === true,
      pieceId: typeof partial.pieceId === "string" ? partial.pieceId : "",
    });
    const failed = structured.cardTitle === "素材没有生成";
    const capped = structured.cardTitle === "已达本次上限";
    const payload: AgentChatResponseBody = {
      messageId: `material_${Date.now()}`,
      done: true,
      leadText: failed || capped ? structured.bodyText
        : structured.outputKind !== "copy_only" && !structured.generatedImageUrl
          ? `文案已生成，配图未完成：${structured.imagePlaceholder || "请查看本次生成提示。"}`
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
  if (!("structured" in result) || !("leadText" in result) || result.structured?.scene !== "guide_turn") {
    return NextResponse.json({ ok: false, error: "invalid_guide_response", leadText: "请求未完成，请检查本地服务。" }, { status: 500 });
  }
  const payload: AgentChatResponseBody = {
    messageId: `guide_${Date.now()}`,
    done: true,
    leadText: result.leadText || undefined,
    structured: result.structured as GuideTurnBlock,
  };
  return NextResponse.json(payload);
}
