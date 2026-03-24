import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { enrichLead } from '@/lib/crm/enricher';
import type { Lead } from '@/types/database';

/**
 * POST /api/leads/[id]/enrich
 * Triggers Claude enrichment for a single lead.
 * Sets enrichment_status = 'pending' → runs Claude → 'done' (or 'failed').
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const svc = createServiceClient();

  // Load the lead
  const { data: lead, error: fetchErr } = await svc
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if ((lead as Lead).is_spam) {
    return NextResponse.json({ error: 'Cannot enrich a spam lead' }, { status: 400 });
  }

  // Mark as pending
  await svc.from('leads').update({ enrichment_status: 'pending' }).eq('id', params.id);

  try {
    const enrichmentData = await enrichLead(lead as Lead);

    // Upsert enrichment record
    await svc.from('lead_enrichments').upsert({
      lead_id: params.id,
      ...enrichmentData,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'lead_id' });

    // Mark lead as done
    await svc.from('leads').update({
      enrichment_status: 'done',
      enrichment_done_at: new Date().toISOString(),
    }).eq('id', params.id);

    // Return updated lead with enrichment
    const { data: updated } = await svc
      .from('leads')
      .select('*, enrichment:lead_enrichments(*)')
      .eq('id', params.id)
      .single();

    return NextResponse.json({ lead: updated });
  } catch (e) {
    await svc.from('leads').update({ enrichment_status: 'failed' }).eq('id', params.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
