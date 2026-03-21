import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

export interface PostSuggestion {
  id: string;
  post_text: string;
  format: string;
  topic_tags: string[];
  product_tags: string[];
  rationale: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { account_id, period_days = 90, product_focus, topic_focus } = await request.json() as {
    account_id: string;
    period_days?: number;
    product_focus?: string;
    topic_focus?: string;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const since = new Date();
  since.setDate(since.getDate() - period_days);
  const sinceStr = since.toISOString().split('T')[0];

  // Fetch top performing posts for this account
  const { data: topPosts } = await supabase
    .from('linkedin_posts')
    .select('post_text, post_format, topic_tags, product_tags, engagement_rate, impressions, post_date')
    .eq('account_id', account_id)
    .gte('post_date', sinceStr)
    .eq('status', 'published')
    .order('engagement_rate', { ascending: false })
    .limit(10);

  // Fetch relevant content items from the library
  let contentQuery = supabase
    .from('content_items')
    .select('title, content_type, description, product_tags, topic_tags')
    .eq('status', 'published')
    .limit(20);

  if (product_focus) contentQuery = contentQuery.overlaps('product_tags', [product_focus]);
  if (topic_focus) contentQuery = contentQuery.overlaps('topic_tags', [topic_focus]);

  const { data: contentItems } = await contentQuery;

  const { data: account } = await supabase
    .from('linkedin_accounts')
    .select('name, account_type')
    .eq('id', account_id)
    .single();

  const prompt = `You are a LinkedIn content strategist for Axis, a B2B electrical products company.

ACCOUNT: ${(account as any)?.name} (${(account as any)?.account_type})
FOCUS: ${product_focus ? `Product: ${product_focus}` : ''}${topic_focus ? ` Topic: ${topic_focus}` : ''}${!product_focus && !topic_focus ? 'General' : ''}

TOP PERFORMING POSTS (last ${period_days} days, sorted by engagement rate):
${JSON.stringify(topPosts || [], null, 2)}

AVAILABLE CONTENT ASSETS IN LIBRARY:
${JSON.stringify(contentItems || [], null, 2)}

Generate 4 LinkedIn post suggestions. Each must be a JSON object with:
- "id": unique string (e.g. "sug-1")
- "post_text": ready-to-use post text (150–300 words, professional B2B tone, includes a hook, value, CTA)
- "format": "text" | "image" | "video" | "carousel" | "document"
- "topic_tags": array of relevant topic tags from the data
- "product_tags": array of relevant product tags from the data
- "rationale": one sentence explaining WHY this will perform well based on the data (reference specific numbers)

Base suggestions on what's actually worked (high engagement rate patterns), not generic advice.

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

    let suggestions: PostSuggestion[];
    try { suggestions = JSON.parse(raw); }
    catch { return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 }); }

    return NextResponse.json({ suggestions });

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Suggestion failed' }, { status: 500 });
  }
}
