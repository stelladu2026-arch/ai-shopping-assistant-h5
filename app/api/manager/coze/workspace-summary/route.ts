import { NextResponse } from "next/server";

/** 不再调用 Coze。店长看板只返回本地说明。 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    status: "disabled",
    error: "已去掉 Coze。本页不请求外部工作流。",
  });
}
