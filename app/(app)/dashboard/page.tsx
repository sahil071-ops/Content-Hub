import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './dashboard-client';
import type {
  UserRoleEnum, MisHighlight, MisPeriodTypeEnum,
  MetricSnapshotRow, NormalizedMetrics,
} from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export interface SnapshotPair {
  current: NormalizedMetrics | null;
  prev: NormalizedMetrics | null;
  /** True when current exists but prev doesn't — baseline is set, comparison not yet available. */
  hasBaseline: boolean;
}

export type SnapshotPairs = Record<string, Record<string, SnapshotPair>>;

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  // ── Legacy mis_snapshots — raw API data for display richness ──────────
  const { data: snapshotRows } = await supabase
    .from('mis_snapshots')
    .select('source, property, period_type, period_start, period_end, data, created_at')
    .order('period_start', { ascending: false })
    .limit(60);

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

  // ── metric_snapshots — for period-over-period comparison ──────────────
  // Fetch enough rows to cover all sources × all period types × 2+ historical snapshots
  const { data: metricRows } = await supabase
    .from('metric_snapshots')
    .select('snapshot_type, source, period_start, period_end, metrics')
    .order('period_start', { ascending: false })
    .limit(200);

  const snapshotPairs: SnapshotPairs = {};

  if (metricRows && metricRows.length > 0) {
    // Group by snapshot_type:source
    type MetricGroup = { snapshot_type: string; source: string; period_start: string; metrics: NormalizedMetrics };
    const groups: Record<string, MetricGroup[]> = {};
    for (const row of metricRows as MetricSnapshotRow[]) {
      const key = `${row.snapshot_type}:${row.source}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row as unknown as MetricGroup);
    }

    for (const [key, snaps] of Object.entries(groups)) {
      const colonIdx = key.indexOf(':');
      const snapType = key.slice(0, colonIdx);
      const source = key.slice(colonIdx + 1);

      if (!snapshotPairs[snapType]) snapshotPairs[snapType] = {};

      const current = snaps[0]; // most recent (already ordered desc)
      if (!current) continue;

      let prev: MetricGroup | null = null;

      if (snapType === 'monthly') {
        // Monthly: compare to same calendar month in the previous year (YoY)
        const currentDate = new Date(current.period_start);
        const targetYear = currentDate.getFullYear() - 1;
        const targetMonth = currentDate.getMonth();
        prev = snaps.find(s => {
          const d = new Date(s.period_start);
          return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
        }) ?? null;
      } else {
        // Weekly / quarterly / annual: use the immediately previous snapshot
        prev = snaps[1] ?? null;
      }

      snapshotPairs[snapType][source] = {
        current: current.metrics,
        prev: prev?.metrics ?? null,
        hasBaseline: prev === null,
      };
    }
  }

  // ── AI highlights ─────────────────────────────────────────────────────
  const { data: highlightRows } = await supabase
    .from('mis_highlights')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(8);

  // ── Lead counts (rolling windows — used when no leads snapshot exists) ─
  const now = new Date();
  const d7   = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d30  = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d90  = new Date(now.getTime() - 90 * 86400000).toISOString();
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
      snapshotPairs={snapshotPairs}
    />
  );
}
