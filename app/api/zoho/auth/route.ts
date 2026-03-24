import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildZohoAuthUrl } from '@/lib/crm/zoho-client';

/**
 * GET /api/zoho/auth?dc=com
 * Redirect admin to Zoho OAuth consent screen.
 * `dc` = data center: com (default) | eu | in | au | jp
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const dc = request.nextUrl.searchParams.get('dc') || 'com';

  // State encodes the data center so the callback knows which Zoho endpoint to use.
  // In production consider signing this with HMAC.
  const state = Buffer.from(JSON.stringify({ dc, ts: Date.now() })).toString('base64url');

  const authUrl = buildZohoAuthUrl(dc, state);

  return NextResponse.redirect(authUrl);
}
