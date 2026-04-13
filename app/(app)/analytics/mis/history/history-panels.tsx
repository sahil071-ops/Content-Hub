'use client';

import { useState } from 'react';
import { RefreshCw, FastForward, CheckCircle2, AlertCircle, Clock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CronStatusPanelProps {
  lastWeeklyPulled: string | null;
  lastMonthlyPulled: string | null;
}

export function CronStatusPanel({ lastWeeklyPulled, lastMonthlyPulled }: CronStatusPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; period_start?: string; period_end?: string; logs?: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runWeeklyNow() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      // Calls the analytics pull API (admin-authed POST) which runs the same logic as the cron
      const res = await fetch('/api/analytics/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_type: 'weekly' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unknown error');
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function fmtTime(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Snapshot Cron Status
        </h2>
        <button
          onClick={runWeeklyNow}
          disabled={running}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running…' : 'Run weekly snapshot now'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-md border p-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Last weekly pull</p>
            <p className="text-sm font-medium truncate">{fmtTime(lastWeeklyPulled)}</p>
          </div>
          <Badge className="ml-auto shrink-0 text-[10px]">Mon 08:00 IST</Badge>
        </div>
        <div className="flex items-center gap-3 rounded-md border p-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Last monthly pull</p>
            <p className="text-sm font-medium truncate">{fmtTime(lastMonthlyPulled)}</p>
          </div>
          <Badge className="ml-auto shrink-0 text-[10px]">1st 09:00 IST</Badge>
        </div>
      </div>

      {/* Cron config note */}
      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <strong>Vercel Hobby plan</strong> supports max 2 cron jobs. This project has 7 crons in{' '}
            <code className="font-mono">vercel.json</code>. If the weekly snapshot cron is not firing,
            remove the legacy <code>/api/cron/mis</code> entries from <code>vercel.json</code> to free
            up slots, or upgrade to Vercel Pro.
          </p>
          <p>
            Use <strong>Run weekly snapshot now</strong> above to trigger a pull immediately without
            waiting for the cron.
          </p>
        </div>
      </div>

      {/* Result / error */}
      {result && (
        <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Weekly snapshot complete</p>
            {result.period_start && (
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
                Period: {result.period_start} → {result.period_end}
              </p>
            )}
            <p className="mt-1">Reload the page to see the updated Pull Logs below.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Snapshot failed</p>
            <p className="mt-0.5 font-mono">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface BackfillPanelProps {
  isAdmin: boolean;
}

interface BackfillResult {
  total_weeks_found: number;
  weeks_already_present: number;
  weeks_backfilled: number;
  detail: Array<{ period: string; sources: string[] }>;
}

export function BackfillPanel({ isAdmin }: BackfillPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('2026-01-01');

  if (!isAdmin) return null;

  async function runBackfill() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/analytics/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_date: fromDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Backfill failed');
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Backfill Missing Weeks
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pulls historical data for all weekly periods that have no snapshots yet. Since the cron
          has not been running, this will populate the Trends page with real data.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="from-date" className="text-xs text-muted-foreground whitespace-nowrap">
            From date:
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-background"
            disabled={running}
          />
        </div>
        <button
          onClick={runBackfill}
          disabled={running}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <FastForward className={`h-3 w-3 ${running ? 'animate-pulse' : ''}`} />
          {running ? 'Backfilling — this may take 2–3 minutes…' : 'Backfill missing weeks'}
        </button>
      </div>

      {running && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Pulling from all APIs for each missing week. Please wait…
        </div>
      )}

      {result && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Backfill complete
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-2">
            <div className="rounded border border-emerald-200 dark:border-emerald-700 p-2">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{result.total_weeks_found}</p>
              <p className="text-emerald-600 dark:text-emerald-500">Weeks found</p>
            </div>
            <div className="rounded border border-emerald-200 dark:border-emerald-700 p-2">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{result.weeks_already_present}</p>
              <p className="text-emerald-600 dark:text-emerald-500">Already had data</p>
            </div>
            <div className="rounded border border-emerald-200 dark:border-emerald-700 p-2">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{result.weeks_backfilled}</p>
              <p className="text-emerald-600 dark:text-emerald-500">Backfilled</p>
            </div>
          </div>
          {result.detail.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.detail.map((d) => (
                <div key={d.period} className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="font-mono">{d.period}</span>
                  <span className="text-emerald-500">— {d.sources.join(', ') || 'LinkedIn + Leads only'}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-emerald-600 dark:text-emerald-500 mt-1">
            Visit the <a href="/analytics/trends" className="underline">Trends page</a> to see your historical data.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Backfill failed</p>
            <p className="mt-0.5 font-mono">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
