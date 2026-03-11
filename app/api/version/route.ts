import { NextResponse } from 'next/server';
import { VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    version: VERSION,
    buildId: process.env.NEXT_PUBLIC_BUILD_ID || 'dev',
    timestamp: Date.now(),
  });
}
