import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LinkedInPost, LinkedInAccount, LinkedInInsightType } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('linkedin_ai_insights')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ insights: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { period_start, period_end, account_id } = await request.json() as {
    period_start?: string;
    period_end?: string;
    account_id?: string;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  // Fetch posts and accounts
  let postsQuery = supabase
    .from('linkedin_posts')
    .select('*, account:linkedin_accounts(id, name, account_type)')
    .eq('status', 'published')
    .order('post_date', { ascending: false })
    .limit(200);

  if (account_id) postsQuery = postsQuery.eq('account_id', account_id);
  if (period_start) postsQuery = postsQuery.gte('post_date', period_start);
  if (period_end) postsQuery = postsQuery.lte('post_date', period_end);

  const { data: posts } = await postsQuery;
  const { data: accounts } = await supabase.from('linkedin_accounts').select('*').eq('is_active', true);

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: 'No posts found for the selected period' }, { status: 400 });
  }

  // Build a compact data summary for Claude
  const accountNames = Object.fromEntries(
    (accounts || []).map((a: LinkedInAccount) => [a.id, a.name])
  );

  const postSummaries = (posts as LinkedInPost[]).map((p) => ({
    id: p.id,
    account: accountNames[p.account_id] || p.account_id,
    date: p.post_date,
    format: p.post_format,
    impressions: p.impressions,
    reactions: p.reactions,
    comments: p.comments,
    shares: p.shares,
    engagement_rate: p.engagement_rate,
    topic_tags: p.topic_tags,
    product_tags: p.product_tags,
    text_preview: p.post_text ? p.post_text.slice(0, 200) : null,
  }));

  // Compute per-account averages for context
  const accountStats: Record<string, { avg_engagement: number; post_count: number }> = {};
  for (const p of posts as LinkedInPost[]) {
    const name = accountNames[p.account_id] || p.account_id;
    if (!accountStats[name]) accountStats[name] = { avg_engagement: 0, post_count: 0 };
    if (p.engagement_rate) {
      accountStats[name].avg_engagement = (accountStats[name].avg_engagement * accountStats[name].post_count + p.engagement_rate) / (accountStats[name].post_count + 1);
    }
    accountStats[name].post_count++;
  }

  const prompt = `You are a LinkedIn performance analyst for Axis, an electrical products B2B company.
Analyse the following LinkedIn post data from ${posts.length} posts across ${Object.keys(accountStats).length} account(s).

ACCOUNT AVERAGES:
${Object.entries(accountStats).map(([name, s]) => `- ${name}: avg engagement ${s.avg_engagement.toFixed(2)}%, ${s.post_count} posts`).join('\n')}

POST DATA (most recent first):
${JSON.stringify(postSummaries, null, 2)}

Generate 5–7 insights. Each insight must be a JSON object with:
- "insight_type": "pattern" | "recommendation" | "anomaly" | "summary"
- "headline": one sentence (max 15 words)
- "explanation": 2–3 sentences with specific numbers and evidence
- "supporting_post_ids": array of post IDs that support this insight (use the "id" field from the post data)

Rules:
- Patterns: consistent behaviours in the data (e.g. carousels always outperform)
- Recommendations: actionable advice framed as "Post more X because Y data shows Z"
- Anomalies: posts that significantly over/underperformed (>50% from account average), with a hypothesis
- At least 1 cross-account comparison insight
- At least 1 format-specific insight
- At least 1 topic/product tag insight
- Be specific with numbers

Return ONLY a valid JSON array. No text outside the array.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const raw = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any[];
    try { parsed = JSON.parse(raw); }
    catch { return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 }); }

    const run_id = uuidv4();
    const inserts = parsed.map((item: any) => ({
      run_id,
      account_id: account_id || null,
      period_start: period_start || null,
      period_end: period_end || null,
      insight_type: (item.insight_type as LinkedInInsightType) || 'pattern',
      content: `${item.headline}\n\n${item.explanation}`,
      supporting_post_ids: item.supporting_post_ids || [],
    }));

    const { data: saved, error } = await supabase
      .from('linkedin_ai_insights')
      .insert(inserts)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ insights: saved, run_id });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Analysis failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, thumbs_up } = await request.json() as { id: string; thumbs_up: boolean | null };
  const { error } = await supabase.from('linkedin_ai_insights').update({ thumbs_up }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
