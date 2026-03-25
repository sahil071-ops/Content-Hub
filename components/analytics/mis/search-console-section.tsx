'use client';

import { TrendingUp, TrendingDown, AlertTriangle, ExternalLink } from 'lucide-react';
import { RechartsLine } from '@/components/analytics/recharts-line';
import { cn } from '@/lib/utils';
import type { GscSnapshotData } from '@/types/database';

interface SearchConsoleSectionProps {
  data: GscSnapshotData;
  countryFilter?: 'all' | 'india';
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function CtrBadge({ ctr }: { ctr: number }) {
  const cls = ctr >= 5
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : ctr >= 1
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return (
    <span className={cn('inline-flex rounded px-1.5 py-0.5 text-xs font-medium tabular-nums', cls)}>
      {ctr}%
    </span>
  );
}

function DeltaCell({ curr, prev }: { curr: number; prev: number }) {
  const d = pctDelta(curr, prev);
  if (d === null) return null;
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium',
      d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-muted-foreground'
    )}>
      {d > 0 ? <TrendingUp className="h-3 w-3" /> : d < 0 ? <TrendingDown className="h-3 w-3" /> : null}
      {d > 0 ? '+' : ''}{d}%
    </span>
  );
}

export function SearchConsoleSection({ data, countryFilter = 'all' }: SearchConsoleSectionProps) {
  const isIndia = countryFilter === 'india';
  const activeData = isIndia && data.india ? data.india : data;
  const queries = isIndia && data.india ? data.india.top_queries : data.top_queries;

  const clickDelta = pctDelta(data.clicks, data.clicks_prev);
  const clickDeltaStr = clickDelta !== null ? ` (${clickDelta >= 0 ? '+' : ''}${clickDelta}% vs prev)` : '';

  // CTR opportunities: impressions > 500, CTR < 1%
  const ctrOpportunities = (data.top_queries as any[]).filter(
    (q: any) => (q.impressions || 0) > 500 && (q.ctr || 0) < 1
  );

  // Top pages with opportunity score
  const pagesWithOpportunity = (data.top_pages || []).map(p => ({
    ...p,
    opportunity: p.clicks > 0 ? Math.round(p.impressions / p.clicks) : p.impressions,
  })).sort((a, b) => b.opportunity - a.opportunity);

  // Auto-summary
  const summary = `${fmt(data.clicks)} clicks${clickDeltaStr} from ${fmt(data.impressions)} impressions (${data.ctr}% CTR, avg position ${data.position}).${ctrOpportunities.length > 0 ? ` ${ctrOpportunities.length} ${ctrOpportunities.length === 1 ? 'query ranks' : 'queries rank'} well but ${ctrOpportunities.length === 1 ? 'is' : 'are'} not being clicked — meta descriptions need work.` : ''}`;

  // Build clicks timeline from top pages if timeline not available
  const hasTimeline = (data as any).timeline && (data as any).timeline.length > 0;

  return (
    <div className="space-y-6 pt-4">
      {/* Auto-summary */}
      <p className="text-sm text-muted-foreground italic border-l-4 border-emerald-500 pl-3 py-1">{summary}</p>

      {/* 4-across hero metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Clicks</p>
          <p className="text-2xl font-bold">{fmt(data.clicks)}</p>
          <DeltaCell curr={data.clicks} prev={data.clicks_prev} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Impressions</p>
          <p className="text-2xl font-bold">{fmt(data.impressions)}</p>
          <DeltaCell curr={data.impressions} prev={data.impressions_prev ?? 0} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg CTR</p>
          <p className="text-2xl font-bold">{data.ctr}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Position</p>
          <p className="text-2xl font-bold">{data.position}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Lower is better</p>
        </div>
      </div>

      {/* India metrics when India filter active */}
      {isIndia && data.india && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">India Clicks</p>
            <p className="text-2xl font-bold">{fmt(data.india.clicks)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">India Impressions</p>
            <p className="text-2xl font-bold">{fmt(data.india.impressions)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">India CTR</p>
            <p className="text-2xl font-bold">{data.india.ctr}%</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">India Position</p>
            <p className="text-2xl font-bold">{data.india.position}</p>
          </div>
        </div>
      )}

      {/* CTR Opportunities amber callout */}
      {ctrOpportunities.length > 0 && !isIndia && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              CTR Opportunities — {ctrOpportunities.length} {ctrOpportunities.length === 1 ? 'query' : 'queries'} ranking well but not getting clicked
            </p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            These pages have &gt;500 impressions but &lt;1% CTR — they rank on page 1 but the titles/meta descriptions aren't compelling enough.
          </p>
          <div className="space-y-1.5">
            {ctrOpportunities.slice(0, 5).map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="flex-1 truncate text-amber-800 dark:text-amber-300 font-medium">{q.query}</span>
                <span className="shrink-0 text-muted-foreground">{fmt(q.impressions)} imp</span>
                <CtrBadge ctr={q.ctr} />
                <span className="shrink-0 text-muted-foreground">pos {q.position}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline if available */}
      {hasTimeline && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Clicks Over Time</h3>
          <RechartsLine
            data={(data as any).timeline}
            series={[{ key: 'clicks', label: 'Clicks', color: '#16a34a' }]}
            height={220}
          />
        </div>
      )}

      {/* Top Queries table */}
      {queries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Top Queries {isIndia ? '(India)' : ''}
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Query</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Clicks</th>
                  {'impressions' in (queries[0] || {}) && (
                    <>
                      <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Impressions</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">CTR</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Position</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {queries.slice(0, 10).map((q: any, i: number) => (
                  <tr key={i} className={cn('border-b border-border/40', i % 2 === 0 ? '' : 'bg-muted/20')}>
                    <td className="py-2 px-3 max-w-52 truncate font-medium">{q.query}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{q.clicks.toLocaleString()}</td>
                    {'impressions' in q && (
                      <>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{q.impressions?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right"><CtrBadge ctr={q.ctr} /></td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{q.position}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Pages with Opportunity Score */}
      {pagesWithOpportunity.length > 0 && !isIndia && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Top Pages</h3>
          <p className="text-xs text-muted-foreground mb-2">
            Opportunity Score = impressions ÷ clicks — high score means high impressions but low clicks (worth improving).
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Page</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Clicks</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Impressions</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Opp. Score</th>
                </tr>
              </thead>
              <tbody>
                {pagesWithOpportunity.slice(0, 10).map((p, i) => (
                  <tr key={i} className={cn(
                    'border-b border-border/40',
                    i % 2 === 0 ? '' : 'bg-muted/20',
                    i < 3 && 'font-medium',
                  )}>
                    <td className="py-2 px-3 max-w-64">
                      <a
                        href={p.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline truncate"
                        title={p.page}
                      >
                        <span className="truncate">{p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                      </a>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{p.clicks.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{p.impressions.toLocaleString()}</td>
                    <td className={cn('py-2 px-3 text-right tabular-nums font-semibold',
                      i < 3 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                    )}>
                      {p.opportunity.toLocaleString()}
                      {i < 3 && <span className="ml-1 text-[10px] font-normal">↑ improve</span>}
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
