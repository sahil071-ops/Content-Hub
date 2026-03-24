import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/leads
 * Query params:
 *   view        = all | spam | clean | high_value
 *   q           = search string (name, email, company)
 *   source      = lead source filter
 *   industry    = industry filter
 *   limit       = max rows (default 200)
 *   offset      = pagination offset
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing', 'sales'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const view     = searchParams.get('view') || 'all';
  const q        = searchParams.get('q') || '';
  const source   = searchParams.get('source') || '';
  const industry = searchParams.get('industry') || '';
  const limit    = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
  const offset   = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('leads')
    .select('*, enrichment:lead_enrichments(*)', { count: 'exact' })
    .order('pulled_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (view === 'spam')       query = query.eq('is_spam', true);
  if (view === 'clean')      query = query.eq('is_spam', false);
  if (view === 'high_value') query = query.eq('is_high_value', true);

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
  }
  if (source)   query = query.eq('lead_source', source);
  if (industry) query = query.eq('industry', industry);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data ?? [], total: count ?? 0 });
}
