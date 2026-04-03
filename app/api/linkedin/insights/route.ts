import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LinkedInPost, LinkedInAccount, LinkedInInsightType } from '@/types/database';

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

  // Fetch all posts (we'll slice ourselves for the payload)
  let postsQuery = supabase
    .from('linkedin_posts')
    .select('id, account_id, post_date, post_format, post_text, impressions, reactions, comments, shares, engagement_rate, topic_tags, product_tags')
    .eq('status', 'published')
    .order('post_date', { ascending: false })
    .limit(500);

  if (account_id) postsQuery = postsQuery.eq('account_id', account_id);
  if (period_start) postsQuery = postsQuery.gte('post_date', period_start);
  if (period_end) postsQuery = postsQuery.lte('post_date', period_end);

  const { data: allPosts, error: postsError } = await postsQuery;
  const { data: accounts } = await supabase.from('linkedin_accounts').select('id, name').eq('is_active', true);

  if (postsError) return NextResponse.json({ error: `Failed to fetch posts: ${postsError.message}` }, { status: 500 });
  if (!allPosts || allPosts.length === 0) {
    return NextResponse.json({ error: 'No posts found for the selected period' }, { status: 400 });
  }

  const accountNames = Object.fromEntries(
    (accounts || []).map((a: Pick<LinkedInAccount, 'id' | 'name'>) => [a.id, a.name])
  );

  // Compute per-account averages across ALL posts
  const accountStats: Record<string, { avg_engagement: number; post_count: number; top_posts: typeof allPosts }> = {};
  for (const p of allPosts as LinkedInPost[]) {
    const name = accountNames[p.account_id] || p.account_id;
    if (!accountStats[name]) accountStats[name] = { avg_engagement: 0, post_count: 0, top_posts: [] };
    if (p.engagement_rate) {
      accountStats[name].avg_engagement = (accountStats[name].avg_engagement * accountStats[name].post_count + p.engagement_rate) / (accountStats[name].post_count + 1);
    }
    accountStats[name].post_count++;
    if (accountStats[name].top_posts.length < 3 && (p.engagement_rate ?? 0) > 0) {
      accountStats[name].top_posts.push(p);
    }
  }

  // Limit to 50 most recent posts for the payload
  const MAX_POSTS = 50;
  const recentPosts = (allPosts as LinkedInPost[]).slice(0, MAX_POSTS);
  const olderPosts = (allPosts as LinkedInPost[]).slice(MAX_POSTS);

  const postSummaries = recentPosts.map((p) => ({
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
    text_preview: p.post_text ? p.post_text.slice(0, 300) : null,
  }));

  // Aggregate older posts as summary stats
  const olderSummary = olderPosts.length > 0 ? (() => {
    const byAccount: Record<string, { count: number; avg_eng: number; top_impressions: number }> = {};
    for (const p of olderPosts) {
      const name = accountNames[p.account_id] || p.account_id;
      if (!byAccount[name]) byAccount[name] = { count: 0, avg_eng: 0, top_impressions: 0 };
      byAccount[name].count++;
      if (p.engagement_rate) byAccount[name].avg_eng = (byAccount[name].avg_eng * (byAccount[name].count - 1) + p.engagement_rate) / byAccount[name].count;
      if ((p.impressions ?? 0) > byAccount[name].top_impressions) byAccount[name].top_impressions = p.impressions ?? 0;
    }
    return Object.entries(byAccount).map(([name, s]) => `${name}: ${s.count} older posts, avg eng ${s.avg_eng.toFixed(2)}%, top impressions ${s.top_impressions.toLocaleString()}`).join('; ');
  })() : null;

  const prompt = `You are a LinkedIn performance analyst for Axis, an electrical products B2B company.
Analyse the following LinkedIn post data. Total: ${allPosts.length} posts across ${Object.keys(accountStats).length} account(s).

ACCOUNT AVERAGES (all ${allPosts.length} posts):
${Object.entries(accountStats).map(([name, s]) => `- ${name}: avg engagement ${s.avg_engagement.toFixed(2)}%, ${s.post_count} posts`).join('\n')}
${olderSummary ? `\nOLDER POSTS SUMMARY (${olderPosts.length} posts prior to the 50 shown below):\n${olderSummary}` : ''}

POST DATA — 50 most recent:
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

    const run_id = crypto.randomUUID();
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
