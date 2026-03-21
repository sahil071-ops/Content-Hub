import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;

  let query = supabase
    .from('linkedin_posts')
    .select('*, account:linkedin_accounts(id, name, avatar_url, account_type)')
    .order('post_date', { ascending: false });

  const account = searchParams.get('account');
  if (account) query = query.in('account_id', account.split(','));

  const format = searchParams.get('format');
  if (format) query = query.in('post_format', format.split(','));

  const topic = searchParams.get('topic');
  if (topic) query = query.overlaps('topic_tags', topic.split(','));

  const product = searchParams.get('product');
  if (product) query = query.overlaps('product_tags', product.split(','));

  const startDate = searchParams.get('start');
  if (startDate) query = query.gte('post_date', startDate);

  const endDate = searchParams.get('end');
  if (endDate) query = query.lte('post_date', endDate);

  const minEngagement = searchParams.get('min_engagement');
  if (minEngagement) query = query.gte('engagement_rate', parseFloat(minEngagement));

  const status = searchParams.get('status') || 'published';
  if (status !== 'all') query = query.eq('status', status);

  const limit = parseInt(searchParams.get('limit') || '200', 10);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  const role = (profile as any)?.role;
  if (!['admin', 'marketing'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();

  // Support bulk insert (array) or single
  const rows = Array.isArray(body) ? body : [body];
  const inserts = rows.map((r: any) => ({
    account_id: r.account_id,
    post_url: r.post_url || null,
    post_date: r.post_date,
    post_text: r.post_text || null,
    post_format: r.post_format || 'text',
    status: r.status || 'published',
    topic_tags: r.topic_tags || [],
    product_tags: r.product_tags || [],
    impressions: r.impressions ?? null,
    reactions: r.reactions ?? null,
    comments: r.comments ?? null,
    shares: r.shares ?? null,
    profile_visits: r.profile_visits ?? null,
    follows_gained: r.follows_gained ?? null,
    link_clicks: r.link_clicks ?? null,
    screenshot_url: r.screenshot_url || null,
    extraction_status: r.extraction_status || 'manual',
    extraction_notes: r.extraction_notes || null,
    linked_content_id: r.linked_content_id || null,
    created_by: user.id,
  }));

  const { data, error } = await supabase.from('linkedin_posts').insert(inserts).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from('linkedin_posts')
    .update(updates)
    .eq('id', id)
    .select('*, account:linkedin_accounts(id, name, avatar_url, account_type)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await request.json();
  const { error } = await supabase.from('linkedin_posts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
