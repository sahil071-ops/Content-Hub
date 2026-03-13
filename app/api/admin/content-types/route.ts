import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireAdminOrMarketing(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null; error: unknown };
  if (!['admin', 'marketing'].includes((profile as any)?.role || '')) return null;
  return user;
}

// GET /api/admin/content-types — list all
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('content_types')
    .select('*')
    .order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/content-types — create new
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const user = await requireAdminOrMarketing(supabase);
  if (!user) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

  const body = await request.json();
  const { key, label, color_classes, sort_order } = body;

  if (!key || !label) return NextResponse.json({ error: 'key and label are required.' }, { status: 400 });

  // Validate key: lowercase, alphanumeric + underscore only
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: 'Key must be lowercase letters, numbers, and underscores only.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('content_types')
    .insert({ key, label, color_classes: color_classes || 'bg-gray-100 text-gray-700 border-gray-200', sort_order: sort_order ?? 99 })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/admin/content-types — update existing (by id in body)
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const user = await requireAdminOrMarketing(supabase);
  if (!user) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  // Prevent changing the key of built-in types (safety measure)
  const { data, error } = await supabase
    .from('content_types')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/content-types?id=... — delete a type
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const user = await requireAdminOrMarketing(supabase);
  if (!user) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  // Check if any content items use this type
  const { data: ct } = await supabase.from('content_types').select('key').eq('id', id).single();
  if (ct) {
    const { count } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', ct.key);
    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} content item(s) still use this type.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from('content_types').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
