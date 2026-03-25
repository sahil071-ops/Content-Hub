'use client';

import { AlertTriangle } from 'lucide-react';
import { RechartsLine } from '@/components/analytics/recharts-line';
import { cn } from '@/lib/utils';
import type { BrevoSnapshotData } from '@/types/database';

interface BrevoSectionProps {
  data: BrevoSnapshotData;
}

const B2B_OPEN_BENCHMARK = 22; // industry benchmark %

function OpenRateBadge({ rate }: { rate: number }) {
  const cls = rate >= 25
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : rate >= 15
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return (
    <span className={cn('inline-flex rounded px-1.5 py-0.5 text-xs font-medium tabular-nums', cls)}>
      {rate}%
    </span>
  );
}

export function BrevoSection({ data }: BrevoSectionProps) {
  const flagged = data.campaigns.filter(c => c.unsubscribe_rate > 0.5);
  const aboveBenchmark = data.avg_open_rate >= B2B_OPEN_BENCHMARK;

  // Auto-summary
  const summary = data.campaigns.length > 0
    ? `${data.campaigns.length} campaign${data.campaigns.length !== 1 ? 's' : ''} sent. Average open rate of ${data.avg_open_rate}% is ${aboveBenchmark ? 'above' : 'below'} the B2B industry benchmark of ${B2B_OPEN_BENCHMARK}%.${flagged.length > 0 ? ` ${flagged.length} campaign${flagged.length > 1 ? 's' : ''} flagged for high unsubscribe rate.` : ''}`
    : 'No campaigns in this period.';

  // Build trend data from campaigns (sorted by send date)
  const trendData = [...data.campaigns]
    .filter(c => c.send_date)
    .sort((a, b) => a.send_date.localeCompare(b.send_date))
    .map(c => ({
      date: c.send_date.slice(0, 10),
      open_rate: c.open_rate,
      click_rate: c.click_rate,
    }));

  return (
    <div className="space-y-6 pt-4">
      {/* Auto-summary */}
      <p className="text-sm text-muted-foreground italic border-l-4 border-teal-500 pl-3 py-1">{summary}</p>

      {/* Hero + secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Hero: avg open rate */}
        <div className="col-span-2 sm:col-span-1 rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Open Rate</p>
          <p className="text-3xl font-bold">{data.avg_open_rate}%</p>
          <p className={cn('text-xs mt-1 font-medium', aboveBenchmark ? 'text-emerald-600' : 'text-red-500')}>
            {aboveBenchmark ? '↑' : '↓'} B2B benchmark: {B2B_OPEN_BENCHMARK}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Campaigns Sent</p>
          <p className="text-2xl font-bold">{data.campaigns.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Click Rate</p>
          <p className="text-2xl font-bold">{data.avg_click_rate}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg CTOR</p>
          <p className="text-2xl font-bold">{data.avg_ctor}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Clicks ÷ Opens</p>
        </div>
      </div>

      {/* Unsubscribe warning */}
      {flagged.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">High Unsubscribe Rate</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              {flagged.length} campaign{flagged.length > 1 ? 's' : ''} exceeded 0.5% unsubscribe rate:{' '}
              <span className="font-medium">{flagged.map(c => c.name).join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* Open rate + click rate trend */}
      {trendData.length > 1 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Open Rate &amp; Click Rate Trend</h3>
          <RechartsLine
            data={trendData}
            series={[
              { key: 'open_rate',  label: 'Open Rate %',  color: '#0d9488' },
              { key: 'click_rate', label: 'Click Rate %', color: '#2323A3' },
            ]}
            height={220}
          />
        </div>
      )}

      {/* Campaign table */}
      {data.campaigns.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Campaigns</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Campaign</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Sent</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Open Rate</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Click Rate</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">CTOR</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Unsub</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c, i) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b border-border/40',
                      i % 2 === 0 ? '' : 'bg-muted/20',
                      c.unsubscribe_rate > 0.5 && 'bg-red-50/60 dark:bg-red-950/20',
                    )}
                  >
                    <td className="py-2 px-3 max-w-48">
                      <p className="truncate font-medium">{c.name}</p>
                      {c.send_date && (
                        <p className="text-muted-foreground text-[11px]">
                          {new Date(c.send_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{c.sent_count.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right"><OpenRateBadge rate={c.open_rate} /></td>
                    <td className="py-2 px-3 text-right tabular-nums">{c.click_rate}%</td>
                    <td className="py-2 px-3 text-right tabular-nums">{c.ctor}%</td>
                    <td className={cn('py-2 px-3 text-right tabular-nums font-medium',
                      c.unsubscribe_rate > 0.5 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                    )}>
                      {c.unsubscribe_rate}%
                      {c.unsubscribe_rate > 0.5 && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
