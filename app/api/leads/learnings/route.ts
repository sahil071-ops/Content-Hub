import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { deriveLearnedRules } from '@/lib/crm/spam-detector';
import type { FeedbackExample } from '@/lib/crm/spam-detector';

/**
 * GET /api/leads/learnings
 * Returns aggregated AI learning stats from lead_feedback table.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing', 'sales'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const svc = createServiceClient();

  const { data: allFeedback } = await svc
    .from('lead_feedback')
    .select('feedback_type, original_decision, user_decision, user_note, created_at, lead:leads(first_name, last_name, email, company, title)')
    .order('created_at', { ascending: false });

  if (!allFeedback) return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });

  const spamFeedback    = allFeedback.filter(f => f.feedback_type === 'spam');
  const qualityFeedback = allFeedback.filter(f => f.feedback_type === 'quality');

  const spamConfirmations  = spamFeedback.filter(f => f.user_decision === f.original_decision).length;
  const spamOverrides      = spamFeedback.filter(f => f.user_decision !== f.original_decision).length;
  const qualityConfirmations = qualityFeedback.filter(f => f.user_decision === f.original_decision).length;
  const qualityOverrides     = qualityFeedback.filter(f => f.user_decision !== f.original_decision).length;

  // Leads marked not-spam by users (AI said spam, user said no)
  const notSpamExamples = spamFeedback
    .filter(f => f.original_decision === true && f.user_decision === false)
    .slice(0, 5);

  // Leads marked spam by users (AI said clean, user said spam)
  const spamExamples = spamFeedback
    .filter(f => f.original_decision === false && f.user_decision === true)
    .slice(0, 5);

  // Leads where quality was upgraded (not high-value → high-value)
  const qualityUpgrades = qualityFeedback
    .filter(f => f.original_decision === false && f.user_decision === true)
    .slice(0, 5);

  // Recent notes with content
  const recentNotes = allFeedback
    .filter(f => f.user_note && f.user_note.trim())
    .slice(0, 10)
    .map(f => ({
      feedback_type: f.feedback_type,
      user_decision: f.user_decision,
      user_note:     f.user_note,
      created_at:    f.created_at,
    }));

  const totalSpamAccuracy = spamFeedback.length
    ? Math.round((spamConfirmations / spamFeedback.length) * 100)
    : null;

  const totalQualityAccuracy = qualityFeedback.length
    ? Math.round((qualityConfirmations / qualityFeedback.length) * 100)
    : null;

  // Derive learned rules from spam feedback examples
  const spamFeedbackExamples: FeedbackExample[] = spamFeedback.map((f: any) => ({
    name:          [f.lead?.first_name, f.lead?.last_name].filter(Boolean).join(' ') || null,
    email:         f.lead?.email ?? null,
    company:       f.lead?.company ?? null,
    title:         f.lead?.title ?? null,
    user_decision: f.user_decision,
    user_note:     f.user_note ?? null,
  }));
  const derivedRules = deriveLearnedRules(spamFeedbackExamples);

  return NextResponse.json({
    total_feedback: allFeedback.length,
    spam: {
      total:         spamFeedback.length,
      confirmations: spamConfirmations,
      overrides:     spamOverrides,
      accuracy_pct:  totalSpamAccuracy,
    },
    quality: {
      total:         qualityFeedback.length,
      confirmations: qualityConfirmations,
      overrides:     qualityOverrides,
      accuracy_pct:  totalQualityAccuracy,
    },
    recent_notes:       recentNotes,
    not_spam_examples:  notSpamExamples.length,
    spam_examples:      spamExamples.length,
    quality_upgrades:   qualityUpgrades.length,
    derived_rules:      derivedRules,
  });
}
