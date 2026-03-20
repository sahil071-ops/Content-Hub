'use client';

import { MetricCard } from '@/components/analytics/metric-card';
import { RechartsBar } from '@/components/analytics/recharts-bar';
import { RechartsLine } from '@/components/analytics/recharts-line';
import type { GA4SnapshotData } from '@/types/database';

interface GA4SectionProps {
  data: GA4SnapshotData;
  countryFilter?: 'all' | 'india';
}

export function GA4Section({ data, countryFilter = 'all' }: GA4SectionProps) {
  const countryData = (() => {
    if (countryFilter === 'india') {
      const india = data.top_countries.find((c) => c.country === 'India');
      return india ? [{ name: 'India', value: india.sessions }] : [];
    }
    return data.top_countries.slice(0, 10).map((c) => ({ name: c.country, value: c.sessions }));
  })();

  const total = data.new_users + data.returning_users || 1;
  const newPct = Math.round((data.new_users / total) * 100);
  const retPct = 100 - newPct;

  return (
    <div className="space-y-5 pt-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Organic Sessions" value={data.organic_sessions} prev={data.organic_sessions_prev} />
        <MetricCard label="New Users" value={data.new_users} />
        <MetricCard label="Returning Users" value={data.returning_users} />
        <MetricCard label="Bounce Rate" value={`${data.bounce_rate}%`} />
      </div>

      {/* New vs returning */}
      <div className="rounded-md border p-4 bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">New vs Returning</p>
        <div className="flex rounded-full overflow-hidden h-3">
          <div className="bg-[#2323A3]" style={{ width: `${newPct}%` }} title={`New: ${newPct}%`} />
          <div className="bg-[#59A7F1]" style={{ width: `${retPct}%` }} title={`Returning: ${retPct}%`} />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#2323A3] mr-1" />New {newPct}%</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-[#59A7F1] mr-1" />Returning {retPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Country breakdown */}
        {countryData.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {countryFilter === 'india' ? 'India Organic Sessions' : 'Top Countries'}
            </h3>
            <RechartsBar data={countryData} color="#2323A3" label="Sessions" horizontal height={200} />
          </div>
        )}

        {/* Sessions timeline */}
        {data.timeline.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Organic Sessions Over Time</h3>
            <RechartsLine
              data={data.timeline}
              series={[{ key: 'sessions', label: 'Sessions', color: '#2323A3' }]}
              height={200}
            />
          </div>
        )}
      </div>
    </div>
  );
}
