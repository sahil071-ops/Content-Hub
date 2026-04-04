import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { UserRoleEnum, NormalizedMetrics } from '@/types/database';
import { TrendsClient } from './trends-client';

export const metadata: Metadata = { title: 'Metric Trends' };
export const dynamic = 'force-dynamic';

export interface SnapshotRow {
  snapshot_type: string;
  period_start: string;
  source: string;
  metrics: NormalizedMetrics;
}

export interface YtSnapshotRow {
  subscriber_count: number;
  pulled_at: string;
}

export default async function TrendsPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  // Fetch all metric_snapshots ordered chronologically
  const { data: snapshotRows } = await supabase
    .from('metric_snapshots')
    .select('snapshot_type, period_start, source, metrics')
    .order('period_start', { ascending: true });

  // Fetch youtube_snapshots for subscriber trend (running total)
  const { data: ytSnapshotRows } = await supabase
    .from('youtube_snapshots')
    .select('subscriber_count, pulled_at')
    .order('pulled_at', { ascending: true });

  return (
    <TrendsClient
      snapshotRows={(snapshotRows || []) as SnapshotRow[]}
      ytSnapshotRows={(ytSnapshotRows || []) as YtSnapshotRow[]}
    />
  );
}
