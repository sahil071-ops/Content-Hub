'use client';

import { useMemo, useState } from 'react';
import { subDays, format, parseISO, startOfWeek, addWeeks, addMonths, startOfMonth } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { SnapshotRow, YtSnapshotRow } from './page';

// ── Source colours (consistent with rest of app) ────────────────
const COLORS = {
  ga4_main:   '#3B82F6', // blue-500
  ga4_es:     '#F97316', // orange-500
  gsc_main:   '#10B981', // emerald-500
  gsc_es:     '#84CC16', // lime-500
  youtube:    '#EF4444', // red-500
  brevo:      '#14B8A6', // teal-500
  leads:      '#8B5CF6', // purple-500
  subscribers:'#EF4444', // red-500 (same as youtube)
};

const LEADS_PALETTE = ['#8B5CF6', '#6D28D9', '#A78BFA', '#C4B5FD', '#7C3AED'];
const LI_ACCOUNT_PALETTE = ['#0077B5', '#00A0DC', '#0288D1', '#039BE5', '#006097'];

const TOOLTIP_CONTENT_STYLE = { backgroundColor: '#1a1a2e', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: '13px' };
const TOOLTIP_LABEL_STYLE = { color: '#d1d5db', marginBottom: '4px' };
const TOOLTIP_ITEM_STYLE = { color: '#f9fafb' };

type SourceFilter = 'all' | 'ga4' | 'gsc' | 'youtube' | 'brevo' | 'leads' | 'linkedin';
type PeriodFilter = 'weekly' | 'monthly';
type RangeFilter  = '8w' | '6m' | '12m' | 'all';

const SOURCE_OPTIONS: { key: SourceFilter; label: string }[] = [
  { key: 'all',      label: 'All Sources' },
  { key: 'ga4',      label: 'GA4' },
  { key: 'gsc',      label: 'Search Console' },
  { key: 'youtube',  label: 'YouTube' },
  { key: 'brevo',    label: 'Brevo' },
  { key: 'leads',    label: 'Leads' },
  { key: 'linkedin', label: 'LinkedIn' },
];

const RANGE_OPTIONS: { key: RangeFilter; label: string }[] = [
  { key: '8w',  label: 'Last 8 weeks' },
  { key: '6m',  label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
];

interface TrendsClientProps {
  snapshotRows: SnapshotRow[];
  ytSnapshotRows: YtSnapshotRow[];
}

// ── Helpers ──────────────────────────────────────────────────────

function fmtDate(dateStr: string, period: PeriodFilter): string {
  try {
    const d = parseISO(dateStr);
    return period === 'monthly' ? format(d, 'MMM yyyy') : format(d, 'MMM d');
  } catch {
    return dateStr;
  }
}

function nextPullDate(period: PeriodFilter): string {
  const now = new Date();
  if (period === 'monthly') {
    return format(startOfMonth(addMonths(now, 1)), 'd MMM yyyy');
  }
  // Next Monday
  const nextMonday = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  return format(nextMonday, 'd MMM yyyy');
}

/** Returns the cutoff Date or null for 'all'. */
function getCutoff(range: RangeFilter): Date | null {
  const today = new Date();
  if (range === '8w')  return subDays(today, 56);
  if (range === '6m')  return subDays(today, 180);
  if (range === '12m') return subDays(today, 365);
  return null;
}

/** Merge multiple sources onto a shared time axis keyed by period_start. */
function mergeByDate<T extends string>(
  rows: SnapshotRow[],
  sources: T[],
  metricKey: string,
): Record<string, { date: string } & Partial<Record<T, number>>> {
  const map: Record<string, { date: string } & Partial<Record<T, number>>> = {};
  for (const row of rows) {
    if (!(sources as string[]).includes(row.source)) continue;
    const d = row.period_start;
    if (!map[d]) map[d] = { date: d } as { date: string } & Partial<Record<T, number>>;
    const val = (row.metrics as any)[metricKey];
    if (typeof val === 'number') {
      (map[d] as any)[row.source] = val;
    }
  }
  return map;
}

/** Sort map entries by date and convert to array. */
function sortedValues<T>(map: Record<string, T>): T[] {
  return Object.keys(map)
    .sort()
    .map((k) => map[k]);
}

// ── Chart wrapper ─────────────────────────────────────────────────
function ChartCard({
  title, description, children, dataCount, period,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  dataCount: number;
  period: PeriodFilter;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {dataCount >= 1 ? (
        <>
          {children}
          {dataCount < 3 && (
            <p className="text-center text-[10px] text-muted-foreground">
              {dataCount === 1
                ? 'Only 1 data point — trends will appear after a few more weekly pulls'
                : `${dataCount} data points — trends will be clearer after ${3 - dataCount} more pull${3 - dataCount > 1 ? 's' : ''}`}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground rounded-md bg-muted/30 border border-dashed">
          <p className="font-medium">No data yet</p>
          <p className="text-xs mt-1">
            Use the <a href="/analytics/mis/history" className="underline">Pull History</a> page to run
            a snapshot or backfill missing weeks. First pull expected:{' '}
            {nextPullDate(period)}.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Custom X-axis tick formatter ──────────────────────────────────
function makeTickFormatter(period: PeriodFilter) {
  return (v: string) => fmtDate(v, period);
}

// ── Tooltip label formatter ───────────────────────────────────────
function makeTooltipLabel(period: PeriodFilter) {
  return (label: unknown) => fmtDate(String(label ?? ''), period);
}

// ── Main component ────────────────────────────────────────────────
export function TrendsClient({ snapshotRows, ytSnapshotRows }: TrendsClientProps) {
  const [source, setSource] = useState<SourceFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('weekly');
  const [range, setRange] = useState<RangeFilter>('8w');

  const cutoff = useMemo(() => getCutoff(range), [range]);

  // ── Filter rows by period + date range ────────────────────────
  const filtered = useMemo(() =>
    snapshotRows.filter((r) =>
      r.snapshot_type === period &&
      (!cutoff || new Date(r.period_start) >= cutoff)
    ),
    [snapshotRows, period, cutoff]
  );

  // ── Filter youtube_snapshots by date range ────────────────────
  const filteredYtSnaps = useMemo(() =>
    ytSnapshotRows.filter((r) =>
      !cutoff || new Date(r.pulled_at) >= cutoff
    ),
    [ytSnapshotRows, cutoff]
  );

  // ── Chart 1: Organic Sessions (ga4_main + ga4_es) ─────────────
  const ga4Data = useMemo(() => {
    const map = mergeByDate(filtered, ['ga4_main', 'ga4_es'], 'organic_sessions');
    return sortedValues(map);
  }, [filtered]);

  // ── Chart 2: Search Console Clicks (gsc_main + gsc_es) ────────
  const gscData = useMemo(() => {
    const map = mergeByDate(filtered, ['gsc_main', 'gsc_es'], 'clicks');
    return sortedValues(map);
  }, [filtered]);

  // ── Chart 3: YouTube Views ─────────────────────────────────────
  const ytViewData = useMemo(() =>
    filtered
      .filter((r) => r.source === 'youtube')
      .map((r) => ({ date: r.period_start, views: r.metrics.views ?? 0 })),
    [filtered]
  );

  // ── Chart 4: YouTube Subscriber Count (running total) ─────────
  const ytSubData = useMemo(() =>
    filteredYtSnaps.map((r) => ({
      date: r.pulled_at.slice(0, 10),
      subscribers: r.subscriber_count,
    })),
    [filteredYtSnaps]
  );

  // ── Chart 5: Email Open Rate (brevo) ──────────────────────────
  const brevoData = useMemo(() =>
    filtered
      .filter((r) => r.source === 'brevo')
      .map((r) => ({ date: r.period_start, open_rate: r.metrics.avg_open_rate ?? 0 })),
    [filtered]
  );

  // ── Chart 6: Leads by form source (stacked bar) ───────────────
  const { leadsData, formKeys } = useMemo(() => {
    const rows = filtered.filter((r) => r.source === 'leads');
    const allKeys = new Set<string>();
    const data = rows.map((r) => {
      const row: Record<string, number | string> = { date: r.period_start };
      for (const [key, val] of Object.entries(r.metrics.by_form || {})) {
        row[key] = val;
        allKeys.add(key);
      }
      return row;
    });
    return { leadsData: data, formKeys: Array.from(allKeys) };
  }, [filtered]);

  // ── Chart 7+8: LinkedIn engagement + impressions ─────────────
  const { liEngagementData, liImpressionData, liAccountKeys } = useMemo(() => {
    const rows = filtered.filter((r) => r.source === 'linkedin');
    const allAccounts = new Set<string>();

    const engData = rows.map((r) => {
      const point: Record<string, number | string> = {
        date: r.period_start,
        overall: r.metrics.avg_engagement_rate ?? 0,
      };
      for (const [name, acc] of Object.entries(r.metrics.by_account ?? {})) {
        point[name] = acc.avg_engagement_rate;
        allAccounts.add(name);
      }
      return point;
    });

    const impData = rows.map((r) => {
      const point: Record<string, number | string> = { date: r.period_start };
      for (const [name, acc] of Object.entries(r.metrics.by_account ?? {})) {
        point[name] = acc.total_impressions;
        allAccounts.add(name);
      }
      return point;
    });

    return {
      liEngagementData: engData,
      liImpressionData: impData,
      liAccountKeys: Array.from(allAccounts),
    };
  }, [filtered]);

  // ── Visibility by source filter ───────────────────────────────
  const show = {
    ga4:      source === 'all' || source === 'ga4',
    gsc:      source === 'all' || source === 'gsc',
    youtube:  source === 'all' || source === 'youtube',
    brevo:    source === 'all' || source === 'brevo',
    leads:    source === 'all' || source === 'leads',
    linkedin: source === 'all' || source === 'linkedin',
  };

  const tickFmt = makeTickFormatter(period);
  const tooltipLabel = makeTooltipLabel(period);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Page header ───────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Metric Trends</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Historical performance across all channels — powered by stored snapshots
        </p>
      </div>

      {/* ── Sticky controls ───────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b -mx-4 md:-mx-6 px-4 md:px-6 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            {SOURCE_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setSource(o.key)}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors whitespace-nowrap',
                  source === o.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Period */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(['weekly', 'monthly'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 font-medium capitalize transition-colors',
                  period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {p === 'weekly' ? 'Weekly snapshots' : 'Monthly snapshots'}
              </button>
            ))}
          </div>

          {/* Range */}
          <div className="flex rounded-md border overflow-hidden text-xs">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setRange(o.key)}
                className={cn(
                  'px-3 py-1.5 font-medium transition-colors whitespace-nowrap',
                  range === o.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* 1 — Organic Sessions */}
        {show.ga4 && (
          <ChartCard
            title="Organic Sessions"
            description="Sessions from organic search — main site and Spanish site"
            dataCount={ga4Data.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ga4Data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown) => [(v as number).toLocaleString(), '']} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="ga4_main" name="Main Site" stroke={COLORS.ga4_main} dot={ga4Data.length < 3 ? { r: 3 } : false} strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="ga4_es"   name="ES Site"   stroke={COLORS.ga4_es}   dot={ga4Data.length < 3 ? { r: 3 } : false} strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 2 — Search Console Clicks */}
        {show.gsc && (
          <ChartCard
            title="Search Console Clicks"
            description="Organic clicks from Google Search — main site and Spanish site"
            dataCount={gscData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gscData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown) => [(v as number).toLocaleString(), '']} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="gsc_main" name="Main Site" stroke={COLORS.gsc_main} dot={gscData.length < 3 ? { r: 3 } : false} strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="gsc_es"   name="ES Site"   stroke={COLORS.gsc_es}   dot={gscData.length < 3 ? { r: 3 } : false} strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 3 — YouTube Views per period */}
        {show.youtube && (
          <ChartCard
            title="YouTube Views per Period"
            description="Sum of views across recent videos per pull"
            dataCount={ytViewData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ytViewData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown) => [(v as number).toLocaleString(), 'Views']} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Bar dataKey="views" name="Views" fill={COLORS.youtube} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 4 — YouTube Subscriber Count (running total) */}
        {show.youtube && (
          <ChartCard
            title="YouTube Subscriber Count"
            description="Running total subscribers at each pull — from youtube_snapshots"
            dataCount={ytSubData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ytSubData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => {
                    try { return format(parseISO(v), 'MMM d'); } catch { return v; }
                  }}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip
                  labelFormatter={(v) => { try { return format(parseISO(String(v ?? '')), 'dd MMM yyyy'); } catch { return String(v ?? ''); } }}
                  formatter={(v: unknown) => [(v as number).toLocaleString(), 'Subscribers']}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Line type="monotone" dataKey="subscribers" name="Subscribers" stroke={COLORS.subscribers} dot={ytSubData.length < 3 ? { r: 3 } : false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 5 — Email Open Rate */}
        {show.brevo && (
          <ChartCard
            title="Email Open Rate"
            description="Average open rate across Brevo campaigns per period"
            dataCount={brevoData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={brevoData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown) => [`${(v as number).toFixed(1)}%`, 'Open Rate']} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Line type="monotone" dataKey="open_rate" name="Open Rate" stroke={COLORS.brevo} dot={brevoData.length < 3 ? { r: 3 } : false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 6 — New Leads per period (stacked by form source) */}
        {show.leads && (
          <ChartCard
            title="New Leads per Period"
            description="Leads submitted per period, broken down by source / form"
            dataCount={leadsData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown, name: unknown) => [(v as number).toLocaleString(), String(name)]} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                {formKeys.length > 1 && <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                {formKeys.length > 0 ? (
                  formKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={LEADS_PALETTE[i % LEADS_PALETTE.length]} radius={i === formKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))
                ) : (
                  <Bar dataKey="total_leads" name="Leads" fill={COLORS.leads} radius={[3, 3, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 7 — LinkedIn Avg Engagement Rate */}
        {show.linkedin && (
          <ChartCard
            title="LinkedIn Avg Engagement Rate"
            description="Average engagement rate per period — overall and per account"
            dataCount={liEngagementData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={liEngagementData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown) => [`${(v as number).toFixed(2)}%`, '']} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                {liAccountKeys.length > 0 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                <Line type="monotone" dataKey="overall" name="Overall" stroke="#0077B5" strokeWidth={2} dot={liEngagementData.length < 3 ? { r: 3 } : false} strokeDasharray="4 2" />
                {liAccountKeys.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={LI_ACCOUNT_PALETTE[(i + 1) % LI_ACCOUNT_PALETTE.length]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* 8 — LinkedIn Total Impressions (stacked by account) */}
        {show.linkedin && (
          <ChartCard
            title="LinkedIn Total Impressions"
            description="Total impressions per period, stacked by account"
            dataCount={liImpressionData.length}
            period={period}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={liImpressionData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tickFmt} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={tooltipLabel} formatter={(v: unknown, name: unknown) => [(v as number).toLocaleString(), String(name)]} contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                {liAccountKeys.length > 1 && <Legend iconType="rect" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                {liAccountKeys.length > 0 ? (
                  liAccountKeys.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="li"
                      fill={LI_ACCOUNT_PALETTE[i % LI_ACCOUNT_PALETTE.length]}
                      radius={i === liAccountKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))
                ) : (
                  <Bar dataKey="total_impressions" name="Impressions" fill="#0077B5" radius={[3, 3, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

      </div>

      {/* ── Empty state when no source data matches the filter ── */}
      {!show.ga4 && !show.gsc && !show.youtube && !show.brevo && !show.leads && !show.linkedin && (
        <div className="py-16 text-center text-muted-foreground">
          <p>No charts to show for the selected filters.</p>
        </div>
      )}
    </div>
  );
}
