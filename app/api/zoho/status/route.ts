import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** GET /api/zoho/status — returns connection info for the admin page. */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { data } = await supabase
    .from('zoho_connections')
    .select('id, data_center, zoho_user_email, connected_at, last_pull_at, is_active')
    .eq('is_active', true)
    .maybeSingle();

  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ connection: data ?? null, lead_count: count ?? 0 });
}
