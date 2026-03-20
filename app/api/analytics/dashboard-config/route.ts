import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DashboardConfigData } from '@/types/database';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dashboard = request.nextUrl.searchParams.get('dashboard') || 'mis';

  // Try user-specific config first, then fall back to default
  const { data: userConfig } = await supabase
    .from('dashboard_configs')
    .select('*')
    .eq('user_id', user.id)
    .eq('dashboard_name', dashboard)
    .single();

  if (userConfig) return NextResponse.json({ config: userConfig });

  // Fall back to default layout
  const { data: defaultConfig } = await supabase
    .from('dashboard_configs')
    .select('*')
    .eq('is_default', true)
    .eq('dashboard_name', dashboard)
    .is('user_id', null)
    .single();

  return NextResponse.json({ config: defaultConfig || null });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dashboard_name, config, set_as_default } = await request.json() as {
    dashboard_name: string;
    config: DashboardConfigData;
    set_as_default?: boolean;
  };

  if (set_as_default) {
    // Only admin can set default
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    await supabase.from('dashboard_configs').upsert({
      user_id: null,
      dashboard_name,
      config,
      is_default: true,
    }, { onConflict: 'user_id,dashboard_name' });
    return NextResponse.json({ success: true });
  }

  // Save user-specific config
  await supabase.from('dashboard_configs').upsert({
    user_id: user.id,
    dashboard_name,
    config,
    is_default: false,
  }, { onConflict: 'user_id,dashboard_name' });

  return NextResponse.json({ success: true });
}
