'use client';

import { MetricCard } from '@/components/analytics/metric-card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrevoSnapshotData } from '@/types/database';

interface BrevoSectionProps {
  data: BrevoSnapshotData;
}

export function BrevoSection({ data }: BrevoSectionProps) {
  const flagged = data.campaigns.filter((c) => c.unsubscribe_rate > 0.5);

  return (
    <div className="space-y-5 pt-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Campaigns Sent" value={data.campaigns.length} />
        <MetricCard label="Avg Open Rate" value={`${data.avg_open_rate}%`} />
        <MetricCard label="Avg Click Rate" value={`${data.avg_click_rate}%`} />
        <MetricCard label="Avg CTOR" value={`${data.avg_ctor}%`} />
      </div>

      {/* Unsubscribe warning */}
      {flagged.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">High Unsubscribe Rate Warning</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {flagged.length} campaign{flagged.length > 1 ? 's' : ''} exceeded 0.5% unsubscribe rate:{' '}
              {flagged.map((c) => c.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Campaign table */}
      {data.campaigns.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Campaigns</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Sent</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Open</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Click</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">CTOR</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Unsub</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/30',
                      c.unsubscribe_rate > 0.5 && 'bg-amber-50/50 dark:bg-amber-950/20'
                    )}
                  >
                    <td className="py-1.5 pr-4 max-w-48">
                      <p className="truncate">{c.name}</p>
                      <p className="text-muted-foreground">{c.send_date ? new Date(c.send_date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : ''}</p>
                    </td>
                    <td className="py-1.5 pr-3 text-right">{c.sent_count.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right">{c.open_rate}%</td>
                    <td className="py-1.5 pr-3 text-right">{c.click_rate}%</td>
                    <td className="py-1.5 pr-3 text-right">{c.ctor}%</td>
                    <td className={cn('py-1.5 text-right font-medium', c.unsubscribe_rate > 0.5 ? 'text-amber-600 dark:text-amber-400' : '')}>
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
