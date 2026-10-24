import { NextResponse } from "next/server";
import { guideAct, guideMemoryBook } from "@/lib/guide/session";

export async function GET() {
  return NextResponse.json((await guideMemoryBook()));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await guideAct(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
