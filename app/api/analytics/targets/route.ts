import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ContentTarget } from '@/types/database';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('content_targets')
    .select('*')
    .order('tag_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: data });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { targets } = await request.json() as { targets: Pick<ContentTarget, 'tag_name' | 'tag_type' | 'target_percentage'>[] };

  // Upsert all targets in one go
  const rows = targets.map((t) => ({
    tag_name: t.tag_name,
    tag_type: t.tag_type || 'product',
    target_percentage: t.target_percentage,
    set_by: user.id,
  }));

  const { error } = await supabase
    .from('content_targets')
    .upsert(rows, { onConflict: 'tag_name,tag_type' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
