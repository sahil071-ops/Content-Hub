import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/leads/stats
 * Returns lead arrival counts and source breakdown for the stats panel.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing', 'sales'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now    = new Date();
  const week   = new Date(now); week.setDate(now.getDate() - 7);
  const month  = new Date(now); month.setDate(now.getDate() - 30);
  const quarter = new Date(now); quarter.setDate(now.getDate() - 90);

  const [
    { count: totalCount },
    { count: weekCount },
    { count: monthCount },
    { count: spamCount },
    { count: highValueCount },
    { data: sourcesRaw },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('pulled_at', week.toISOString()),
    supabase.from('leads').select('*', { count: 'exact', head: true }).gte('pulled_at', month.toISOString()),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_spam', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_high_value', true),
    // Source breakdown — fetch all non-null sources for the last 90 days
    supabase.from('leads')
      .select('lead_source')
      .not('lead_source', 'is', null)
      .gte('pulled_at', quarter.toISOString()),
  ]);

  // Tally sources manually (Supabase free tier doesn't support GROUP BY via client)
  const sourceCounts: Record<string, number> = {};
  for (const row of sourcesRaw ?? []) {
    const src = (row as any).lead_source as string;
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const sources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  return NextResponse.json({
    total:      totalCount ?? 0,
    last_7d:    weekCount  ?? 0,
    last_30d:   monthCount ?? 0,
    spam:       spamCount  ?? 0,
    high_value: highValueCount ?? 0,
    sources,
  });
}
