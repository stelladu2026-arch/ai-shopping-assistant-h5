import { NextResponse } from "next/server";
import { buildMomentsMockResponse } from "@/lib/chat/momentsMockRevise";
import { callCozeWorkflow, shouldTryCozeWorkflow } from "@/lib/cozeWorkflow";
import type { AgentChatRequestBody, AgentChatResponseBody, RagPolicyAnswer } from "@/types/agent";

function buildRagMock(): RagPolicyAnswer {
  return {
    scene: "store_rag_query",
    policyTitle: "2026 春季「全屋定制」普惠活动（Mock）",
    priceHighlights: [
      { label: "投影单价", value: "699元/㎡" },
      { label: "满减档", value: "满3万减2000" },
    ],
    conditions: ["仅限定制柜类", "不含进口五金", "限投影面积", "不与清样价同享"],
    activityDeadline: "截止至：2026-06-30 · 剩余天数以总部日历为准",
    suggestedScript:
      "姐，这个活动是工厂直补的，699 一平米还包测量设计，叠加规则我以 POS 为准给您算清楚，避免口头误差。",
    relatedProducts: [
      { id: "p1", name: "定制柜套餐·轻享", shortLabel: "柜" },
      { id: "p2", name: "爆款床+床垫组合", shortLabel: "床" },
      { id: "p3", name: "客厅沙发三件套", shortLabel: "沙" },
    ],
  };
}

export async function POST(req: Request) {
  const partial = (await req.json().catch(() => ({}))) as Partial<AgentChatRequestBody>;
  const scene = partial.scene ?? "store_rag_query";

  const body: AgentChatRequestBody = {
    scene,
    messages: partial.messages ?? [],
    sessionId: partial.sessionId,
    momentsInput: partial.momentsInput,
    attachmentNote: partial.attachmentNote,
  };

  if (shouldTryCozeWorkflow()) {
    const remote = await callCozeWorkflow(body);
    if (remote) {
      console.info("[agent/chat] using Coze workflow", { messageId: remote.messageId });
      return NextResponse.json(remote);
    }
    console.info("[agent/chat] Coze unavailable or response not mapped; using local mock");
  } else {
    console.info("[agent/chat] COZE_WORKFLOW_USE_MOCK enabled — skipping Coze");
  }

  if (scene === "moments_marketing" && partial.momentsInput) {
    try {
      const { structured, leadText } = buildMomentsMockResponse(
        partial.momentsInput,
        partial.messages ?? [],
      );
      const payload: AgentChatResponseBody = {
        messageId: `mock_m_${Date.now()}`,
        done: true,
        leadText,
        structured,
      };
      return NextResponse.json(payload);
    } catch (e) {
      console.error("[agent/chat] moments mock failed", e);
      return NextResponse.json({ error: "moments_mock_failed" }, { status: 500 });
    }
  }

  const payload: AgentChatResponseBody = {
    messageId: `mock_r_${Date.now()}`,
    done: true,
    structured: buildRagMock(),
  };
  return NextResponse.json(payload);
}
