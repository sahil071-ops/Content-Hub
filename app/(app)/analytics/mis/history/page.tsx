import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserRoleEnum, MisPullLog } from '@/types/database';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrevoTestPanel } from './brevo-test-panel';
import { CronStatusPanel, BackfillPanel } from './history-panels';

export const metadata: Metadata = { title: 'MIS Pull History' };
export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const SOURCE_CHIP: Record<string, string> = {
  ga4_main:       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ga4_es:         'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  gsc_main:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  gsc_es:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  youtube:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  brevo:          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  leads:          'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  linkedin:       'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  // legacy labels
  ga4:            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  search_console: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

interface MetricSnapshotRow {
  id: string;
  snapshot_type: string;
  source: string;
  period_start: string;
  period_end: string;
  pulled_at: string;
}

export default async function MisHistoryPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
  const role = ((profile as { role?: string } | null)?.role || 'viewer') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(role)) redirect('/library');
  const isAdmin = role === 'admin';

  const [{ data: logs }, { data: metricSnaps }] = await Promise.all([
    supabase.from('mis_pull_logs').select('*').order('pulled_at', { ascending: false }).limit(100),
    supabase
      .from('metric_snapshots')
      .select('id, snapshot_type, source, period_start, period_end, pulled_at')
      .order('period_start', { ascending: false })
      .limit(100),
  ]);

  // Derive last successful pull timestamps per period type from logs
  const weeklyLogs = (logs ?? []).filter((l: MisPullLog) => l.period_type === 'weekly' && l.status === 'success');
  const monthlyLogs = (logs ?? []).filter((l: MisPullLog) => l.period_type === 'monthly' && l.status === 'success');
  const lastWeeklyPulled = weeklyLogs.length > 0 ? weeklyLogs[0].pulled_at : null;
  const lastMonthlyPulled = monthlyLogs.length > 0 ? monthlyLogs[0].pulled_at : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics/mis" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Pull History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All past data pulls and snapshots</p>
        </div>
      </div>

      {/* Cron Status + Run Now */}
      <CronStatusPanel
        lastWeeklyPulled={lastWeeklyPulled}
        lastMonthlyPulled={lastMonthlyPulled}
      />

      {/* Backfill (admin only) */}
      <BackfillPanel isAdmin={isAdmin} />

      {/* Brevo Diagnostic */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Brevo API Diagnostic</h2>
        <BrevoTestPanel />
      </section>

      {/* Metric Snapshots (normalised table) */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Metric Snapshots{' '}
          <span className="text-xs font-normal normal-case">(used by Trends and Dashboard)</span>
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Source</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Period</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Date Range</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Pulled At</th>
              </tr>
            </thead>
            <tbody>
              {(metricSnaps ?? []).map((s: MetricSnapshotRow) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-4">
                    <Badge className={SOURCE_CHIP[s.source] ?? ''}>{s.source.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="py-2 px-4 capitalize text-muted-foreground">{s.snapshot_type}</td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">
                    {new Date(s.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} –{' '}
                    {new Date(s.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">
                    {new Date(s.pulled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {(!metricSnaps || metricSnaps.length === 0) && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No metric snapshots yet — run a pull or use the Backfill button above</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pull logs */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pull Logs</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Source</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Period</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Time</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Error</th>
              </tr>
            </thead>
            <tbody>
              {(logs || []).map((l: MisPullLog) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-4">
                    <Badge className={SOURCE_CHIP[l.source] ?? ''}>{l.source.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="py-2 px-4 capitalize">{l.period_type}</td>
                  <td className="py-2 px-4">
                    <Badge className={STATUS_COLORS[l.status] || ''}>{l.status}</Badge>
                  </td>
                  <td className="py-2 px-4 text-xs text-muted-foreground">
                    {new Date(l.pulled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-4 text-xs text-red-600 dark:text-red-400 max-w-xs truncate">
                    {l.error_message || '—'}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No pull logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
