import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/tags?type=topic&type=product&q=safe
 * Returns tags from tags_master filtered by type and optional search query.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const types = searchParams.getAll('type');
  const q = searchParams.get('q')?.trim() || '';

  let query = supabase
    .from('tags_master')
    .select('id, name, tag_type, color')
    .order('name');

  if (types.length > 0) {
    query = query.in('tag_type', types);
  }

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data ?? [] });
}
