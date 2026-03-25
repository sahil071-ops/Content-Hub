'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { RechartsBar } from '@/components/analytics/recharts-bar';
import { RechartsLine } from '@/components/analytics/recharts-line';
import { cn } from '@/lib/utils';
import type { GA4SnapshotData } from '@/types/database';

interface GA4SectionProps {
  data: GA4SnapshotData;
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

export function GA4Section({ data, countryFilter = 'all' }: GA4SectionProps) {
  const total = (data.new_users + data.returning_users) || 1;
  const newPct = Math.round((data.new_users / total) * 100);
  const retPct = 100 - newPct;

  const delta = pctDelta(data.organic_sessions, data.organic_sessions_prev);

  const countryData = (() => {
    if (countryFilter === 'india') {
      const india = data.top_countries.find(c => c.country === 'India');
      return india ? [{ name: 'India', value: india.sessions }] : [];
    }
    return data.top_countries.slice(0, 8).map(c => ({ name: c.country, value: c.sessions }));
  })();

  // India callout
  const totalCountrySessions = data.top_countries.reduce((s, c) => s + c.sessions, 0) || 1;
  const india = data.top_countries.find(c => c.country === 'India');
  const indiaPct = india ? Math.round((india.sessions / totalCountrySessions) * 100) : 0;

  // Auto-summary
  const deltaStr = delta !== null
    ? ` (${delta >= 0 ? '+' : ''}${delta}% vs previous period)`
    : '';
  const summary = `Organic traffic${deltaStr}. ${indiaPct > 0 ? `India drove ${indiaPct}% of organic sessions. ` : ''}${newPct}% of visitors are new.`;

  return (
    <div className="space-y-6 pt-4">
      {/* Auto-summary */}
      <p className="text-sm text-muted-foreground italic border-l-4 border-blue-500 pl-3 py-1">{summary}</p>

      {/* Hero + scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Hero: Organic sessions */}
        <div className="col-span-2 sm:col-span-1 rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Organic Sessions</p>
          <p className="text-3xl font-bold">{fmt(data.organic_sessions)}</p>
          {delta !== null && (
            <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium',
              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
            )}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta > 0 ? '+' : ''}{delta}% vs prev period
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">New Users</p>
          <p className="text-2xl font-bold">{fmt(data.new_users)}</p>
          <p className="text-xs text-muted-foreground mt-1">{newPct}% of visitors</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Returning Users</p>
          <p className="text-2xl font-bold">{fmt(data.returning_users)}</p>
          <p className="text-xs text-muted-foreground mt-1">{retPct}% of visitors</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bounce Rate</p>
          <p className="text-2xl font-bold">{data.bounce_rate}%</p>
        </div>
      </div>

      {/* India callout — prominent single stat */}
      {indiaPct > 0 && countryFilter === 'all' && (
        <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🇮🇳</span>
          <div>
            <span className="font-bold text-lg text-orange-700 dark:text-orange-300">{indiaPct}% of traffic is from India</span>
            <span className="text-sm text-orange-600/80 dark:text-orange-400/80 ml-2">({fmt(india?.sessions || 0)} sessions)</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Country breakdown */}
        {countryData.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {countryFilter === 'india' ? 'India Organic Sessions' : 'Top 8 Countries'}
            </h3>
            <RechartsBar
              data={countryData}
              color="#2323A3"
              label="Sessions"
              horizontal
              height={Math.max(200, countryData.length * 32)}
            />
          </div>
        )}

        {/* Sessions over time — taller */}
        {data.timeline.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Organic Sessions Over Time
            </h3>
            <RechartsLine
              data={data.timeline}
              series={[{ key: 'sessions', label: 'Sessions', color: '#2323A3' }]}
              height={260}
            />
          </div>
        )}
      </div>
    </div>
  );
}
