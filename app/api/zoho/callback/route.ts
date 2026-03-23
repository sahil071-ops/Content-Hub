import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, fetchZohoUserInfo } from '@/lib/crm/zoho-client';

/**
 * GET /api/zoho/callback?code=...&state=...
 * Zoho redirects here after OAuth consent.
 * Exchanges the code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${appBase}/admin/zoho?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appBase}/admin/zoho?error=missing_params`);
  }

  // Decode state to get data center
  let dc = 'com';
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    dc = decoded.dc ?? 'com';
  } catch {
    return NextResponse.redirect(`${appBase}/admin/zoho?error=invalid_state`);
  }

  // Verify the admin is logged in
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appBase}/login`);

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.redirect(`${appBase}/admin/zoho?error=not_admin`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, dc);

    // Fetch user info to record which org this is
    const userInfo = await fetchZohoUserInfo(tokens.access_token, dc);

    const svc = createServiceClient();

    // Deactivate any existing connections
    await svc.from('zoho_connections').update({ is_active: false }).eq('is_active', true);

    // Store new connection
    await svc.from('zoho_connections').insert({
      data_center:      dc,
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      zoho_user_email:  userInfo.email,
      zoho_org_id:      userInfo.org_id,
      connected_by:     user.id,
      is_active:        true,
    });

    return NextResponse.redirect(`${appBase}/admin/zoho?connected=1`);
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.redirect(`${appBase}/admin/zoho?error=${encodeURIComponent(msg)}`);
  }
}
