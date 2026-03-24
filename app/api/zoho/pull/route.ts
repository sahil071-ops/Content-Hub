import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchZohoLeads } from '@/lib/crm/zoho-client';
import { analyseSpam, computeQualityScore, type FeedbackExample } from '@/lib/crm/spam-detector';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let since: string | undefined;
  try {
    const body = await request.json();
    since = body?.since;
  } catch { /* no body */ }

  const svc = createServiceClient();

  // ── Load recent spam feedback as training examples for Claude ──
  const { data: rawFeedback } = await svc
    .from('lead_feedback')
    .select('user_decision, user_note, lead:leads(first_name, last_name, email, company, title)')
    .eq('feedback_type', 'spam')
    .order('created_at', { ascending: false })
    .limit(20);

  const feedbackExamples: FeedbackExample[] = (rawFeedback ?? []).map((fb: any) => ({
    name:            [fb.lead?.first_name, fb.lead?.last_name].filter(Boolean).join(' ') || null,
    email:           fb.lead?.email ?? null,
    company:         fb.lead?.company ?? null,
    title:           fb.lead?.title ?? null,
    user_decision:   fb.user_decision,
    user_note:       fb.user_note ?? null,
  }));

  const results = {
    fetched: 0,
    upserted: 0,
    spam: 0,
    high_value: 0,
    errors: [] as string[],
  };

  try {
    const { records } = await fetchZohoLeads({ since, limit: 200 });
    results.fetched = records.length;

    for (const rec of records) {
      try {
        const { spam_score, is_spam, spam_reasons } = await analyseSpam(rec, feedbackExamples);
        // Spam and high-value are mutually exclusive by definition
        const quality_score = is_spam ? 0 : computeQualityScore({
          email:   rec.Email,
          company: rec.Company,
          phone:   rec.Phone,
          mobile:  rec.Mobile,
          title:   rec.Designation,
          website: rec.Website,
          country: rec.Country,
        });
        const is_high_value = !is_spam && quality_score >= 60;

        if (is_spam)      results.spam++;
        if (is_high_value) results.high_value++;

        const payload = {
          zoho_id:           rec.id,
          first_name:        rec.First_Name ?? null,
          last_name:         rec.Last_Name  ?? null,
          email:             rec.Email      ?? null,
          phone:             rec.Phone      ?? null,
          mobile:            rec.Mobile     ?? null,
          company:           rec.Company    ?? null,
          title:             rec.Designation ?? null,
          website:           rec.Website    ?? null,
          lead_source:       rec.Lead_Source ?? null,
          industry:          rec.Industry   ?? null,
          lead_status:       rec.Lead_Status ?? null,
          rating:            rec.Rating     ?? null,
          description:       rec.Description ?? null,
          country:           rec.Country    ?? null,
          is_spam,
          spam_score,
          spam_reasons,
          quality_score,
          is_high_value,
          enrichment_status: 'none' as const,
          raw_data:          rec as Record<string, unknown>,
          zoho_created_at:   rec.Created_Time ?? null,
          zoho_modified_at:  rec.Modified_Time ?? null,
          pulled_at:         new Date().toISOString(),
        };

        const { error } = await svc
          .from('leads')
          .upsert(payload, { onConflict: 'zoho_id', ignoreDuplicates: false })
          .select('id')
          .single();

        if (error) results.errors.push(`${rec.id}: ${error.message}`);
        else results.upserted++;
      } catch (e) {
        results.errors.push(`${rec.id}: ${(e as Error).message}`);
      }
    }

    await svc
      .from('zoho_connections')
      .update({ last_pull_at: new Date().toISOString() })
      .eq('is_active', true);

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json(results);
}
