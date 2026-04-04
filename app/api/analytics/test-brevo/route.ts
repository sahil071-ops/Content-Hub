import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/test-brevo
 * Validates the BREVO_API_KEY by calling the /account endpoint.
 * Returns full diagnostic info: key preview, exact URL, headers sent, status, and full response body.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'BREVO_API_KEY env var is not set' });
  }

  const keyPreview = apiKey.slice(0, 8);
  const url = 'https://api.brevo.com/v3/account';
  const headers = {
    'api-key': `${keyPreview}...`,
    'Accept': 'application/json',
  };

  try {
    const res = await fetch(url, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    const body = await res.json() as Record<string, unknown>;

    return NextResponse.json({
      ok: res.ok,
      key_preview: keyPreview,
      url,
      headers_sent: headers,
      status: res.status,
      body,
      ...(res.status === 401 ? {
        hint: 'The key is invalid. Make sure you are using an API v3 key from Brevo Settings → SMTP & API → API Keys tab (starts with xkeysib-). The MCP key and SMTP password will not work here.',
      } : {}),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      key_preview: keyPreview,
      url,
      headers_sent: headers,
      error: String(e),
    });
  }
}
