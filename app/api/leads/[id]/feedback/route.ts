import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/leads/[id]/feedback
 * Store a spam or quality feedback decision from a reviewer.
 * The feedback is used as few-shot training examples in future Claude calls.
 *
 * Body:
 *   feedback_type      'spam' | 'quality'
 *   original_decision  boolean  — what the AI decided
 *   user_decision      boolean  — what the reviewer says it should be
 *   user_note          string?  — optional explanation
 *
 * If feedback_type='spam' and user_decision=false → also marks lead as not-spam
 * If feedback_type='quality' and user_decision=true → marks as high-value
 * etc.
 */
export async function POST(
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
  const { feedback_type, original_decision, user_decision, user_note } = body;

  if (!['spam', 'quality'].includes(feedback_type)) {
    return NextResponse.json({ error: 'Invalid feedback_type' }, { status: 400 });
  }

  const svc = createServiceClient();

  // 1. Store feedback for future training
  await svc.from('lead_feedback').insert({
    lead_id:           params.id,
    feedback_type,
    original_decision: !!original_decision,
    user_decision:     !!user_decision,
    user_note:         user_note || null,
    reviewed_by:       user.id,
  });

  // 2. Apply the decision to the lead immediately — spam and high_value are mutually exclusive
  const leadUpdates: Record<string, unknown> = { spam_reviewed: true };

  if (feedback_type === 'spam') {
    leadUpdates.is_spam = user_decision;
    // If marking as spam, can't be high-value. If un-spamming, preserve quality_score.
    if (user_decision) leadUpdates.is_high_value = false;
  }

  if (feedback_type === 'quality') {
    leadUpdates.is_high_value = user_decision;
    // If marking as NOT high-value, don't touch spam flag.
    // If marking as high-value, ensure it's not spam.
    if (user_decision) leadUpdates.is_spam = false;
  }

  const { data: updated, error } = await svc
    .from('leads')
    .update(leadUpdates)
    .eq('id', params.id)
    .select('*, enrichment:lead_enrichments(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: updated });
}
