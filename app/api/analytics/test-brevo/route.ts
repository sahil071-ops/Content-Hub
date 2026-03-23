import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/test-brevo
 * Validates the BREVO_API_KEY by calling the /account endpoint.
 * Returns the account name/email on success, or the full error on failure.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'BREVO_API_KEY env var is not set' });
  }

  const keyPreview = `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`;

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    const body = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        key_preview: keyPreview,
        status: res.status,
        error: body.message ?? JSON.stringify(body),
        hint: res.status === 401
          ? 'The key is invalid. Make sure you are using an API v3 key from Brevo Settings → SMTP & API → API Keys tab (starts with xkeysib-). The MCP key and SMTP password will not work here.'
          : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      key_preview: keyPreview,
      account_email: body.email,
      account_name: `${body.firstName ?? ''} ${body.lastName ?? ''}`.trim() || body.companyName,
      plan: (body.plan as any[])?.[0]?.type,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, key_preview: keyPreview, error: String(e) });
  }
}
