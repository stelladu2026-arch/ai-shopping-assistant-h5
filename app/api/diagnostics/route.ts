import { NextResponse } from 'next/server';
import { imageStatus, imageRequest } from '@/lib/guide/image';
import { imageDiagnostics } from '@/server/runtime-info.mjs';

export const dynamic = 'force-dynamic';

/** Read-only diagnostics. Does not call a model or expose credentials. */
export async function GET() {
  return NextResponse.json(imageDiagnostics(process.env, imageStatus, imageRequest), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
