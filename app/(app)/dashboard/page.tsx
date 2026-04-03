import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';
import type {
  UserRoleEnum, MisHighlight, MisPeriodTypeEnum,
  GA4SnapshotData, GscSnapshotData, YoutubeSnapshotData, BrevoSnapshotData,
} from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  // Fetch latest snapshots for all periods
  const { data: snapshotRows } = await supabase
    .from('mis_snapshots')
    .select('source, property, period_type, period_start, period_end, data, created_at')
    .order('period_start', { ascending: false })
    .limit(60);

  // Build a map: period_type -> source -> data
  type PeriodKey = MisPeriodTypeEnum;
  const byPeriod: Record<string, Record<string, any>> = {};
  for (const row of snapshotRows || []) {
    const key = row.period_type as PeriodKey;
    if (!byPeriod[key]) byPeriod[key] = {};
    const srcKey = row.property !== 'default' ? `${row.source}_${row.property}` : row.source;
    if (!byPeriod[key][srcKey]) {
      byPeriod[key][srcKey] = row.data;
    }
  }

  // Fetch latest AI highlights for each period
  const { data: highlightRows } = await supabase
    .from('mis_highlights')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(8);

  // Lead counts for the last 7 / 30 / 90 / 365 days
  const now = new Date();
  const d7  = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const d365 = new Date(now.getTime() - 365 * 86400000).toISOString();

  const [lw, lm, lq, la] = await Promise.all([
    supabase.from('leads').select('id, is_spam, is_high_value', { count: 'exact', head: false }).gte('submitted_at', d7),
    supabase.from('leads').select('id, is_spam, is_high_value', { count: 'exact', head: false }).gte('submitted_at', d30),
    supabase.from('leads').select('id, is_spam, is_high_value', { count: 'exact', head: false }).gte('submitted_at', d90),
    supabase.from('leads').select('id, is_spam, is_high_value', { count: 'exact', head: false }).gte('submitted_at', d365),
  ]);

  const leadCounts = {
    weekly:    { total: lw.count ?? 0,  spam: (lw.data  || []).filter(l => l.is_spam).length,  high_value: (lw.data  || []).filter(l => l.is_high_value).length  },
    monthly:   { total: lm.count ?? 0,  spam: (lm.data  || []).filter(l => l.is_spam).length,  high_value: (lm.data  || []).filter(l => l.is_high_value).length  },
    quarterly: { total: lq.count ?? 0,  spam: (lq.data  || []).filter(l => l.is_spam).length,  high_value: (lq.data  || []).filter(l => l.is_high_value).length  },
    annual:    { total: la.count ?? 0,  spam: (la.data  || []).filter(l => l.is_spam).length,  high_value: (la.data  || []).filter(l => l.is_high_value).length  },
  };

  const lastPullAt = snapshotRows?.[0]?.created_at ?? null;

  return (
    <DashboardClient
      byPeriod={byPeriod}
      highlights={highlightRows as MisHighlight[] || []}
      leadCounts={leadCounts}
      lastPullAt={lastPullAt}
    />
  );
}
