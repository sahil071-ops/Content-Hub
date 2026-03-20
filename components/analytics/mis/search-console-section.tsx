'use client';

import { MetricCard } from '@/components/analytics/metric-card';
import { Badge } from '@/components/ui/badge';
import type { GscSnapshotData } from '@/types/database';

interface SearchConsoleSectionProps {
  data: GscSnapshotData;
  countryFilter?: 'all' | 'india';
}

export function SearchConsoleSection({ data, countryFilter = 'all' }: SearchConsoleSectionProps) {
  const d = countryFilter === 'india' && data.india ? data.india : data;
  const isIndia = countryFilter === 'india';

  const queries = isIndia && data.india
    ? data.india.top_queries
    : data.top_queries;

  return (
    <div className="space-y-5 pt-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Clicks" value={data.clicks} prev={data.clicks_prev} />
        <MetricCard label="Impressions" value={data.impressions} />
        <MetricCard label="Avg CTR" value={`${data.ctr}%`} format="percent" />
        <MetricCard label="Avg Position" value={data.position} />
      </div>

      {isIndia && data.india && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="India Clicks" value={data.india.clicks} />
          <MetricCard label="India Impressions" value={data.india.impressions} />
          <MetricCard label="India CTR" value={`${data.india.ctr}%`} />
          <MetricCard label="India Position" value={data.india.position} />
        </div>
      )}

      {/* Top queries */}
      {queries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Top Queries {isIndia ? '(India)' : ''}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Query</th>
                  <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Clicks</th>
                  {'impressions' in queries[0] && (
                    <>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Impressions</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">CTR</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Position</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {queries.slice(0, 10).map((q, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5 pr-4 max-w-56 truncate">{q.query}</td>
                    <td className="py-1.5 pr-4 text-right">{q.clicks.toLocaleString()}</td>
                    {'impressions' in q && (
                      <>
                        <td className="py-1.5 pr-4 text-right">{(q as any).impressions?.toLocaleString()}</td>
                        <td className="py-1.5 pr-4 text-right">{(q as any).ctr}%</td>
                        <td className="py-1.5 text-right">{(q as any).position}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top pages */}
      {'top_pages' in data && data.top_pages.length > 0 && !isIndia && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Pages</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Page</th>
                  <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {data.top_pages.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5 pr-4 max-w-64 truncate text-blue-600 dark:text-blue-400">
                      <a href={p.page} target="_blank" rel="noopener noreferrer">{p.page.replace(/^https?:\/\/[^/]+/, '')}</a>
                    </td>
                    <td className="py-1.5 pr-4 text-right">{p.clicks.toLocaleString()}</td>
                    <td className="py-1.5 text-right">{p.impressions.toLocaleString()}</td>
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
