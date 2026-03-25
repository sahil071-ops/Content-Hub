import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { analyseSpam, computeQualityScore, type FeedbackExample } from '@/lib/crm/spam-detector';
import type { ZohoLeadRecord } from '@/lib/crm/zoho-client';

/**
 * POST /api/leads/reevaluate
 * Re-runs spam + quality scoring on ALL existing leads using the latest feedback examples.
 * Does NOT overwrite leads that have been manually reviewed (spam_reviewed = true).
 * Optionally pass { force: true } in body to re-evaluate even reviewed leads.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch { /* no body */ }

  const svc = createServiceClient();

  // Load feedback examples for few-shot training
  const { data: rawFeedback } = await svc
    .from('lead_feedback')
    .select('user_decision, user_note, lead:leads(first_name, last_name, email, company, title)')
    .eq('feedback_type', 'spam')
    .order('created_at', { ascending: false })
    .limit(20);

  const feedbackExamples: FeedbackExample[] = (rawFeedback ?? []).map((fb: any) => ({
    name:          [fb.lead?.first_name, fb.lead?.last_name].filter(Boolean).join(' ') || null,
    email:         fb.lead?.email    ?? null,
    company:       fb.lead?.company  ?? null,
    title:         fb.lead?.title    ?? null,
    user_decision: fb.user_decision,
    user_note:     fb.user_note      ?? null,
  }));

  // Fetch leads to re-evaluate (skip manually reviewed unless forced)
  let query = svc
    .from('leads')
    .select('id, zoho_id, first_name, last_name, email, phone, mobile, company, title, website, country, lead_source, description, spam_reviewed');

  if (!force) {
    query = query.eq('spam_reviewed', false);
  }

  const { data: leads, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const results = {
    total:      leads?.length ?? 0,
    updated:    0,
    spam:       0,
    high_value: 0,
    errors:     [] as string[],
  };

  for (const lead of leads ?? []) {
    try {
      // Map DB lead shape to ZohoLeadRecord shape for analyseSpam
      const rec: Partial<ZohoLeadRecord> = {
        id:           lead.zoho_id ?? lead.id,
        First_Name:   lead.first_name  ?? undefined,
        Last_Name:    lead.last_name   ?? undefined,
        Email:        lead.email       ?? undefined,
        Phone:        lead.phone       ?? undefined,
        Mobile:       lead.mobile      ?? undefined,
        Company:      lead.company     ?? undefined,
        Designation:  lead.title       ?? undefined,
        Website:      lead.website     ?? undefined,
        Country:      lead.country     ?? undefined,
        Lead_Source:  lead.lead_source ?? undefined,
        Description:  lead.description ?? undefined,
      };

      const { spam_score, is_spam, spam_reasons } = await analyseSpam(
        rec as ZohoLeadRecord,
        feedbackExamples,
      );

      const quality_score = is_spam ? 0 : computeQualityScore({
        email:   lead.email,
        company: lead.company,
        phone:   lead.phone,
        mobile:  lead.mobile,
        title:   lead.title,
        website: lead.website,
        country: lead.country,
      });
      const is_high_value = !is_spam && quality_score >= 60;

      if (is_spam)       results.spam++;
      if (is_high_value) results.high_value++;

      const { error: updateError } = await svc
        .from('leads')
        .update({ is_spam, spam_score, spam_reasons, quality_score, is_high_value })
        .eq('id', lead.id);

      if (updateError) results.errors.push(`${lead.id}: ${updateError.message}`);
      else results.updated++;
    } catch (e) {
      results.errors.push(`${lead.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json(results);
}
