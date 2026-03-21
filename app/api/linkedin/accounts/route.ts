import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LinkedInAccount } from '@/types/database';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json() as Partial<LinkedInAccount>;
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .insert({ name: body.name, account_type: body.account_type || 'personal', profile_url: body.profile_url || null, avatar_url: body.avatar_url || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json() as LinkedInAccount;
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({ name: body.name, account_type: body.account_type, profile_url: body.profile_url, avatar_url: body.avatar_url, is_active: body.is_active })
    .eq('id', body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
