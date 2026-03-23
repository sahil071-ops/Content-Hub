import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchZohoLeads } from '@/lib/crm/zoho-client';
import { analyseSpam, computeQualityScore } from '@/lib/crm/spam-detector';

/**
 * POST /api/zoho/pull
 * Pulls leads from Zoho, runs spam detection, and upserts into `leads` table.
 * Only admin can trigger a pull.
 *
 * Body (optional): { since?: string }  — ISO date to pull only modified-after leads
 */
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
  } catch { /* no body is fine */ }

  const svc = createServiceClient();

  const results = {
    fetched: 0,
    new: 0,
    updated: 0,
    spam: 0,
    high_value: 0,
    errors: [] as string[],
  };

  try {
    // Fetch up to 200 leads per pull (Zoho page limit)
    const { records } = await fetchZohoLeads({ since, limit: 200 });
    results.fetched = records.length;

    for (const rec of records) {
      try {
        // Run spam detection
        const { spam_score, is_spam, spam_reasons } = await analyseSpam(rec);
        const quality_score = is_spam ? 0 : computeQualityScore(rec);
        const is_high_value = !is_spam && quality_score >= 60;

        if (is_spam) results.spam++;
        if (is_high_value) results.high_value++;

        const payload = {
          zoho_id:          rec.id,
          first_name:       rec.First_Name ?? null,
          last_name:        rec.Last_Name ?? null,
          email:            rec.Email ?? null,
          phone:            rec.Phone ?? null,
          mobile:           rec.Mobile ?? null,
          company:          rec.Company ?? null,
          title:            rec.Designation ?? null,
          website:          rec.Website ?? null,
          lead_source:      rec.Lead_Source ?? null,
          industry:         rec.Industry ?? null,
          lead_status:      rec.Lead_Status ?? null,
          rating:           rec.Rating ?? null,
          description:      rec.Description ?? null,
          country:          rec.Country ?? null,
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

        const { error, data: existing } = await svc
          .from('leads')
          .upsert(payload, { onConflict: 'zoho_id', ignoreDuplicates: false })
          .select('id')
          .single();

        if (error) {
          results.errors.push(`${rec.id}: ${error.message}`);
        } else {
          results.new++; // upsert counts both new and updated
        }
      } catch (e) {
        results.errors.push(`${rec.id}: ${(e as Error).message}`);
      }
    }

    // Update last_pull_at
    await svc
      .from('zoho_connections')
      .update({ last_pull_at: new Date().toISOString() })
      .eq('is_active', true);

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json(results);
}
