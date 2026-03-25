import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing', 'sales'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*, enrichment:lead_enrichments(*)')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ lead: data });
}

/**
 * PUT /api/leads/[id]
 * Enforces mutual exclusivity: a lead cannot be both spam AND high-value.
 * - Setting is_spam=true always clears is_high_value
 * - Setting is_high_value=true always clears is_spam
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  const safeFields = ['is_spam', 'spam_reviewed', 'is_high_value', 'lead_status', 'rating'];
  for (const f of safeFields) {
    if (f in body) allowed[f] = body[f];
  }

  // Enforce mutual exclusivity
  if (allowed.is_spam === true)       allowed.is_high_value = false;
  if (allowed.is_high_value === true) allowed.is_spam = false;

  const { data, error } = await supabase
    .from('leads')
    .update(allowed)
    .eq('id', params.id)
    .select('*, enrichment:lead_enrichments(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
