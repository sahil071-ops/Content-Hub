import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cron/pull-zoho-leads
 * Runs every 4 hours via Vercel Cron.
 * Delegates to the existing /api/zoho/pull POST handler (reuses all spam logic).
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Call the Zoho pull API on the same host
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  try {
    const res = await fetch(`${protocol}://${host}/api/zoho/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the cron secret so internal call is authorised
        ...(cronSecret ? { 'x-cron-internal': cronSecret } : {}),
      },
      body: JSON.stringify({ source: 'cron' }),
    });

    const json = await res.json();
    return NextResponse.json({ success: res.ok, ...json });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
