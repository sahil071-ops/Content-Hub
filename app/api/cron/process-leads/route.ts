import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { analyseSpam, computeQualityScore, deriveLearnedRules, type FeedbackExample } from '@/lib/crm/spam-detector';
import type { ZohoLeadRecord } from '@/lib/crm/zoho-client';

/**
 * GET /api/cron/process-leads
 * Runs every 15 minutes via Vercel Cron.
 * Re-evaluates unreviewed leads using the latest feedback, applying derived rules.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();

  // Load recent spam feedback
  const { data: rawFeedback } = await svc
    .from('lead_feedback')
    .select('user_decision, user_note, lead:leads(first_name, last_name, email, company, title)')
    .eq('feedback_type', 'spam')
    .order('created_at', { ascending: false })
    .limit(30);

  const feedbackExamples: FeedbackExample[] = (rawFeedback ?? []).map((fb: any) => ({
    name:          [fb.lead?.first_name, fb.lead?.last_name].filter(Boolean).join(' ') || null,
    email:         fb.lead?.email    ?? null,
    company:       fb.lead?.company  ?? null,
    title:         fb.lead?.title    ?? null,
    user_decision: fb.user_decision,
    user_note:     fb.user_note      ?? null,
  }));

  // Process only leads that haven't been manually reviewed and were pulled in the last 48h
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: leads } = await svc
    .from('leads')
    .select('id, zoho_id, first_name, last_name, email, phone, mobile, company, title, website, country, lead_source, description, spam_reviewed')
    .eq('spam_reviewed', false)
    .gte('pulled_at', cutoff);

  if (!leads || leads.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let updated = 0;
  for (const lead of leads) {
    try {
      const rec: Partial<ZohoLeadRecord> = {
        id:          lead.zoho_id ?? lead.id,
        First_Name:  lead.first_name ?? undefined,
        Last_Name:   lead.last_name  ?? undefined,
        Email:       lead.email      ?? undefined,
        Phone:       lead.phone      ?? undefined,
        Mobile:      lead.mobile     ?? undefined,
        Company:     lead.company    ?? undefined,
        Designation: lead.title      ?? undefined,
        Website:     lead.website    ?? undefined,
        Country:     lead.country    ?? undefined,
        Lead_Source: lead.lead_source ?? undefined,
        Description: lead.description ?? undefined,
      };

      const { spam_score, is_spam, spam_reasons } = await analyseSpam(rec as ZohoLeadRecord, feedbackExamples);
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

      await svc.from('leads').update({ is_spam, spam_score, spam_reasons, quality_score, is_high_value }).eq('id', lead.id);
      updated++;
    } catch { /* skip individual errors */ }
  }

  return NextResponse.json({ success: true, processed: leads.length, updated });
}
