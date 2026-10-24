import { NextResponse } from "next/server";
import { storeFeed } from "@/lib/guide/store-feed";

export async function GET() {
  return NextResponse.json((await storeFeed()));
}
