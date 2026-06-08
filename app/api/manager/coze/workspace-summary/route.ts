import { NextResponse } from "next/server";
import { fetchPublishedBotsSummary } from "@/lib/cozeOpenApi";

/**
 * 店长端：探测 Coze 开放平台 PAT + Workspace 是否可用，并返回已发布 Bot 数量（不落密钥到前端）。
 */
export async function GET() {
  const summary = await fetchPublishedBotsSummary();
  /** 始终 200，便于脚本拉 JSON；是否成功看 body.ok */
  return NextResponse.json(summary);
}
