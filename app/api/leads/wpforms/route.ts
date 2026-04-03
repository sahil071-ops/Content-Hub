import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { analyseSpam, computeQualityScore, type FeedbackExample } from '@/lib/crm/spam-detector';
import { verifyEmail } from '@/lib/crm/email-verifier';

/**
 * POST /api/leads/wpforms
 *
 * WPForms webhook receiver. Processes each submission synchronously —
 * spam classification + quality scoring run inline before the response
 * is returned, so no separate cron is needed.
 *
 * Authentication: optional WPFORMS_WEBHOOK_SECRET env var.
 * If set, the request must include the header:
 *   X-WPForms-Secret: <secret>
 *
 * WPForms webhook payload shape (Webhooks addon, JSON format):
 * {
 *   "wpforms": {
 *     "id":       "123",          // form ID
 *     "entry_id": "456",          // submission ID
 *     "fields": {
 *       "1": { "name": "First Name", "value": "John" },
 *       "2": { "name": "Last Name",  "value": "Doe"  },
 *       ...
 *     }
 *   }
 * }
 *
 * Field matching is case-insensitive and supports common label variants
 * (e.g. "Full Name", "Your Name", "Email Address", "Organisation", etc.).
 */
export const maxDuration = 60;

// ─── field-name matchers ──────────────────────────────────────────────────────

function matchField(fields: Record<string, { name: string; value: string }>, ...patterns: string[]): string | null {
  for (const entry of Object.values(fields)) {
    const label = entry.name.toLowerCase().trim();
    if (patterns.some((p) => label.includes(p.toLowerCase()))) {
      const v = entry.value?.trim() || null;
      return v || null;
    }
  }
  return null;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Optional webhook secret validation
  const webhookSecret = process.env.WPFORMS_WEBHOOK_SECRET;
  if (webhookSecret) {
    const header = request.headers.get('x-wpforms-secret') ?? request.headers.get('x-webhook-secret');
    if (header !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: any;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await request.json();
  } else {
    // WPForms older versions send form-encoded; parse manually
    const text = await request.text();
    const params = new URLSearchParams(text);
    body = Object.fromEntries(params.entries());
  }

  // Support both wrapped { wpforms: { ... } } and flat payloads
  const payload = body?.wpforms ?? body;
  const formId   = String(payload?.id ?? 'unknown');
  const entryId  = String(payload?.entry_id ?? Date.now());
  const rawFields: Record<string, { name: string; value: string }> = payload?.fields ?? {};

  // If fields is an array, normalise to object
  const fields: Record<string, { name: string; value: string }> = Array.isArray(rawFields)
    ? Object.fromEntries(rawFields.map((f: any, i: number) => [String(i), f]))
    : rawFields;

  // ── Map form fields to lead schema ──────────────────────────────────────────
  const firstName  = matchField(fields, 'first name', 'first');
  const lastName   = matchField(fields, 'last name', 'last', 'surname');
  const fullName   = matchField(fields, 'full name', 'your name', 'name');
  const email      = matchField(fields, 'email');
  const phone      = matchField(fields, 'phone', 'telephone', 'contact number', 'mobile');
  const company    = matchField(fields, 'company', 'organisation', 'organization', 'business', 'firm');
  const title      = matchField(fields, 'job title', 'designation', 'position', 'role', 'title');
  const website    = matchField(fields, 'website', 'url');
  const country    = matchField(fields, 'country');
  const message    = matchField(fields, 'message', 'description', 'enquiry', 'inquiry', 'query', 'requirement');
  const industry   = matchField(fields, 'industry', 'sector');

  // Split full name if first/last weren't separate fields
  let resolvedFirst = firstName;
  let resolvedLast  = lastName;
  if (!resolvedFirst && !resolvedLast && fullName) {
    const parts = fullName.split(' ');
    resolvedFirst = parts[0] ?? null;
    resolvedLast  = parts.slice(1).join(' ') || null;
  }

  // Synthetic unique ID — prefixed so it never clashes with Zoho IDs
  const wpfLeadId = `wpf_${formId}_${entryId}`;

  const svc = createServiceClient();

  // ── Load recent feedback examples for spam classifier ──────────────────────
  const { data: rawFeedback } = await svc
    .from('lead_feedback')
    .select('user_decision, user_note, lead:leads(first_name, last_name, email, company, title)')
    .eq('feedback_type', 'spam')
    .order('created_at', { ascending: false })
    .limit(20);

  const feedbackExamples: FeedbackExample[] = (rawFeedback ?? []).map((fb: any) => ({
    name:          [fb.lead?.first_name, fb.lead?.last_name].filter(Boolean).join(' ') || null,
    email:         fb.lead?.email   ?? null,
    company:       fb.lead?.company ?? null,
    title:         fb.lead?.title   ?? null,
    user_decision: fb.user_decision,
    user_note:     fb.user_note     ?? null,
  }));

  // ── Spam classification ─────────────────────────────────────────────────────
  const pseudoRecord = {
    id:          wpfLeadId,
    First_Name:  resolvedFirst  ?? undefined,
    Last_Name:   resolvedLast   ?? undefined,
    Email:       email          ?? undefined,
    Phone:       phone          ?? undefined,
    Company:     company        ?? undefined,
    Designation: title          ?? undefined,
    Website:     website        ?? undefined,
    Country:     country        ?? undefined,
    Lead_Source: 'WPForms',
    Description: message        ?? undefined,
  } as any;

  const { spam_score, is_spam, spam_reasons } = await analyseSpam(pseudoRecord, feedbackExamples);
  const quality_score = is_spam ? 0 : computeQualityScore({
    email,
    company,
    phone,
    mobile: null,
    title,
    website,
    country,
  });
  const is_high_value = !is_spam && quality_score >= 60;

  // ── Email verification (non-spam only) ──────────────────────────────────────
  let emailVerification: { email_valid?: boolean; email_disposable?: boolean; email_deliverable?: boolean } = {};
  if (!is_spam && email && process.env.ABSTRACT_API_KEY) {
    const verification = await verifyEmail(email);
    if (verification) {
      emailVerification = verification;
      if (verification.email_disposable) {
        spam_reasons.push('Disposable email detected');
      }
    }
  }

  // ── Upsert lead ─────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error } = await svc.from('leads').upsert(
    {
      zoho_id:           wpfLeadId,
      first_name:        resolvedFirst  ?? null,
      last_name:         resolvedLast   ?? null,
      email:             email          ?? null,
      phone:             phone          ?? null,
      mobile:            null,
      company:           company        ?? null,
      title:             title          ?? null,
      website:           website        ?? null,
      lead_source:       'WPForms',
      industry:          industry       ?? null,
      description:       message        ?? null,
      country:           country        ?? null,
      is_spam,
      spam_score,
      spam_reasons,
      quality_score,
      is_high_value,
      enrichment_status: 'none' as const,
      raw_data:          { form_id: formId, entry_id: entryId, fields } as Record<string, unknown>,
      zoho_created_at:   null,
      zoho_modified_at:  null,
      pulled_at:         now,
      submitted_at:      now,
      date_estimated:    false,
      ...emailVerification,
    },
    { onConflict: 'zoho_id', ignoreDuplicates: false }
  );

  if (error) {
    console.error('[wpforms] upsert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success:      true,
    lead_id:      wpfLeadId,
    is_spam,
    spam_score,
    quality_score,
    is_high_value,
  });
}
