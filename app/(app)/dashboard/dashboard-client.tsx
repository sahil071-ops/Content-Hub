'use client';

import { useState } from 'react';
import {
  ChevronDown, ChevronUp, RefreshCw, ThumbsUp, ThumbsDown,
  TrendingUp, TrendingDown, Minus, Sparkles,
  Youtube, Globe, Mail, Users, BarChart3,
  AlertTriangle, Lightbulb, Trophy, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RechartsBar } from '@/components/analytics/recharts-bar';
import { RechartsLine } from '@/components/analytics/recharts-line';
import type { MisHighlight, MisPeriodTypeEnum } from '@/types/database';

type PeriodKey = MisPeriodTypeEnum;

interface DashboardClientProps {
  byPeriod: Record<string, Record<string, any>>;
  highlights: MisHighlight[];
  leadCounts: Record<string, { total: number; spam: number; high_value: number }>;
  lastPullAt: string | null;
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'weekly',    label: 'Weekly' },
  { key: 'monthly',   label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual',    label: 'Annual' },
];

function fmt(n: number | undefined | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(n: number | undefined | null): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

function Delta({ current, prev, invert = false }: { current?: number | null; prev?: number | null; invert?: boolean }) {
  if (current == null || prev == null || prev === 0) return null;
  const change = ((current - prev) / prev) * 100;
  const positive = invert ? change < 0 : change > 0;
  const big = Math.abs(change) >= 20;
  if (Math.abs(change) < 1) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0%</span>;
  return (
    <span className={cn('text-xs font-semibold flex items-center gap-0.5', positive ? 'text-emerald-500' : 'text-red-500')}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {big && (positive ? '▲' : '▼')}{Math.abs(change).toFixed(0)}%
    </span>
  );
}

// ── Collapsible section ──────────────────────────────────────────
function DetailSection({
  title, icon: Icon, iconColor, heroValue, heroLabel, delta, oneLine, children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  heroValue: string;
  heroLabel: string;
  delta?: React.ReactNode;
  oneLine: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Icon className={cn('h-5 w-5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-semibold text-sm">{title}</span>
            <span className="text-2xl font-bold tabular-nums">{heroValue}</span>
            <span className="text-xs text-muted-foreground">{heroLabel}</span>
            {delta}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{oneLine}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <div className="border-t px-5 py-4 space-y-5">{children}</div>}
    </div>
  );
}

// ── Highlight card ───────────────────────────────────────────────
const HIGHLIGHT_META: Record<string, { border: string; bg: string; icon: React.ElementType; iconColor: string }> = {
  WIN:         { border: 'border-emerald-400', bg: 'bg-emerald-500/5', icon: Trophy,      iconColor: 'text-emerald-500' },
  PROBLEM:     { border: 'border-red-400',     bg: 'bg-red-500/5',     icon: AlertTriangle, iconColor: 'text-red-500' },
  OPPORTUNITY: { border: 'border-amber-400',   bg: 'bg-amber-500/5',   icon: Lightbulb,  iconColor: 'text-amber-500' },
  WATCH:       { border: 'border-blue-400',    bg: 'bg-blue-500/5',    icon: Eye,         iconColor: 'text-blue-500' },
};

function HighlightCard({ item, onFeedback }: {
  item: { id: string; text: string; tag: string; data_points?: string[] };
  onFeedback: (id: string, v: boolean | null) => void;
  thumbs?: boolean | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = HIGHLIGHT_META[item.tag] || HIGHLIGHT_META.WATCH;
  const Icon = meta.icon;
  const [headline, ...rest] = item.text.split('\n\n');
  return (
    <div className={cn('rounded-lg border-l-4 p-4 space-y-2', meta.border, meta.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', meta.iconColor)} />
          <Badge variant="outline" className={cn('text-[10px] font-bold shrink-0', meta.iconColor)}>{item.tag}</Badge>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
      <p className="text-sm font-semibold leading-snug">{headline}</p>
      {expanded && rest.length > 0 && (
        <div className="space-y-1.5">
          {rest.map((p, i) => <p key={i} className="text-xs text-muted-foreground leading-relaxed">{p}</p>)}
          {item.data_points && item.data_points.length > 0 && (
            <ul className="space-y-0.5 mt-1">
              {item.data_points.map((dp, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="shrink-0 mt-0.5">•</span>{dp}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1 pt-1">
            <button onClick={() => onFeedback(item.id, true)} className="p-1 rounded hover:bg-black/5 text-muted-foreground hover:text-emerald-600 transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onFeedback(item.id, false)} className="p-1 rounded hover:bg-black/5 text-muted-foreground hover:text-red-600 transition-colors">
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export function DashboardClient({ byPeriod, highlights, leadCounts, lastPullAt }: DashboardClientProps) {
  const [period, setPeriod] = useState<PeriodKey>('weekly');
  const [pulling, setPulling] = useState(false);

  const data = byPeriod[period] || {};
  const ga4    = data['ga4_main']           as any;
  const ga4Es  = data['ga4_es']             as any;
  const gsc    = data['search_console_main'] as any;
  const gscEs  = data['search_console_es']   as any;
  const yt     = data['youtube']             as any;
  const brevo  = data['brevo']               as any;
  const leads  = leadCounts[period]          || { total: 0, spam: 0, high_value: 0 };

  // Latest highlight for selected period
  const highlight = highlights.find(h => h.period_type === period) || highlights[0] || null;
  const highlightItems: any[] = highlight ? (highlight.highlights || []) : [];

  async function pullNow() {
    setPulling(true);
    try {
      await fetch('/api/analytics/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_type: period }),
      });
      window.location.reload();
    } finally {
      setPulling(false);
    }
  }

  async function sendFeedback(itemId: string, value: boolean | null) {
    if (!highlight) return;
    await fetch('/api/analytics/highlights/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlight_id: highlight.id, item_id: itemId, thumbs_up: value }),
    });
  }

  // ── Hero metric cards ────────────────────────────────────────
  const heroMetrics = [
    {
      icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10',
      label: 'Organic Sessions', value: fmt(ga4?.organic_sessions),
      delta: <Delta current={ga4?.organic_sessions} prev={ga4?.organic_sessions_prev} />,
    },
    {
      icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10',
      label: 'Search Clicks', value: fmt(gsc?.clicks),
      delta: <Delta current={gsc?.clicks} prev={gsc?.clicks_prev} />,
    },
    {
      icon: Youtube, color: 'text-red-500', bg: 'bg-red-500/10',
      label: 'YouTube Views', value: fmt(yt?.views),
      delta: <Delta current={yt?.views} prev={yt?.views_prev} />,
    },
    {
      icon: Mail, color: 'text-teal-500', bg: 'bg-teal-500/10',
      label: 'Email Open Rate', value: brevo ? pct(brevo.avg_open_rate) : '—',
      delta: null,
    },
    {
      icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10',
      label: 'New Leads', value: fmt(leads.total),
      delta: null,
    },
  ];

  // ── Summaries ────────────────────────────────────────────────
  const ga4Summary = ga4
    ? `${fmt(ga4.organic_sessions)} sessions. India is ${ga4.top_countries?.find((c: any) => c.country === 'India')?.sessions ? Math.round((ga4.top_countries.find((c: any) => c.country === 'India').sessions / ga4.organic_sessions) * 100) : '?'}% of traffic.`
    : 'No data for this period.';

  const gscSummary = gsc
    ? `${fmt(gsc.clicks)} clicks, ${fmt(gsc.impressions)} impressions, avg position ${gsc.position?.toFixed(1) ?? '—'}.`
    : 'No data for this period.';

  const ytSummary = yt
    ? `${fmt(yt.views)} views across ${yt.top_videos?.length ?? 0} videos. Best: "${yt.top_videos?.[0]?.title?.slice(0, 40) ?? 'N/A'}".`
    : 'No data for this period.';

  const brevoSummary = brevo
    ? `${brevo.campaigns?.length ?? 0} campaigns. Avg open rate ${pct(brevo.avg_open_rate)}, click rate ${pct(brevo.avg_click_rate)}.`
    : 'No data for this period.';

  const leadsSummary = `${leads.total} leads (${leads.spam} spam filtered, ${leads.high_value} high-value).`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Sticky header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b -mx-4 md:-mx-6 px-4 md:px-6 pb-3 pt-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#2323A3]" />
              Dashboard
            </h1>
            {lastPullAt && (
              <p className="text-xs text-muted-foreground">
                Last updated {new Date(lastPullAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Period toggle */}
            <div className="flex rounded-md border overflow-hidden text-xs">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'px-3 py-1.5 font-medium transition-colors',
                    period === p.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={pullNow} disabled={pulling} className="gap-1.5 text-xs">
              <RefreshCw className={cn('h-3.5 w-3.5', pulling && 'animate-spin')} />
              {pulling ? 'Pulling…' : 'Pull now'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section 1: AI Highlights ──────────────────────────── */}
      {highlightItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Highlights</h2>
            {highlight && (
              <p className="text-xs text-muted-foreground">
                {new Date(highlight.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highlightItems.slice(0, 6).map((item: any) => (
              <HighlightCard key={item.id} item={item} onFeedback={sendFeedback} />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 2: Number Strip ───────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Numbers</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {heroMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-lg border bg-card p-4 space-y-2">
                <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md', m.bg)}>
                  <Icon className={cn('h-4 w-4', m.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{m.value}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    {m.delta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 3: Detail Cards ───────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Detail Breakdown</h2>

        {/* YouTube */}
        <DetailSection
          title="YouTube"
          icon={Youtube}
          iconColor="text-red-500"
          heroValue={fmt(yt?.views)}
          heroLabel="views"
          delta={<Delta current={yt?.views} prev={yt?.views_prev} />}
          oneLine={ytSummary}
        >
          {yt ? (
            <div className="space-y-4">
              {yt.top_videos?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Videos</p>
                  <div className="space-y-2">
                    {yt.top_videos.slice(0, 5).map((v: any, i: number) => {
                      const topViews = yt.top_videos[0]?.views || 1;
                      const pctBar = Math.round((v.views / topViews) * 100);
                      return (
                        <div key={v.video_id} className="flex items-start gap-3">
                          {v.thumbnail && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.thumbnail} alt={v.title} className="h-12 w-20 object-cover rounded shrink-0 border" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium line-clamp-1">{v.title}</p>
                            <p className="text-xs text-red-500 font-semibold mt-0.5">{fmt(v.views)} views</p>
                            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${pctBar}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {yt.timeline?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Views Over Time</p>
                  <RechartsLine data={yt.timeline} series={[{ key: 'views', label: 'Views', color: '#EF4444' }]} height={160} />
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">No YouTube data for this period.</p>}
        </DetailSection>

        {/* Website — GA4 + GSC combined */}
        <DetailSection
          title="Website"
          icon={Globe}
          iconColor="text-blue-500"
          heroValue={fmt(ga4?.organic_sessions)}
          heroLabel="organic sessions"
          delta={<Delta current={ga4?.organic_sessions} prev={ga4?.organic_sessions_prev} />}
          oneLine={`${ga4Summary} ${gscSummary}`}
        >
          {(ga4 || gsc) ? (
            <div className="space-y-5">
              {ga4 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GA4 — Traffic</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Organic Sessions', val: fmt(ga4.organic_sessions), sub: <Delta current={ga4.organic_sessions} prev={ga4.organic_sessions_prev} /> },
                      { label: 'New Users', val: fmt(ga4.new_users), sub: null },
                      { label: 'Bounce Rate', val: pct(ga4.bounce_rate), sub: null },
                    ].map(m => (
                      <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-bold">{m.val}</p>
                        {m.sub}
                      </div>
                    ))}
                  </div>
                  {ga4.top_countries?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Countries</p>
                      <RechartsBar
                        data={ga4.top_countries.slice(0, 5).map((c: any) => ({ name: c.country, value: c.sessions }))}
                        color="#3B82F6"
                        label="Sessions"
                        height={140}
                      />
                    </div>
                  )}
                </div>
              )}
              {gsc && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search Console</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Clicks', val: fmt(gsc.clicks), delta: <Delta current={gsc.clicks} prev={gsc.clicks_prev} /> },
                      { label: 'Impressions', val: fmt(gsc.impressions), delta: <Delta current={gsc.impressions} prev={gsc.impressions_prev} /> },
                      { label: 'CTR', val: pct(gsc.ctr), delta: null },
                      { label: 'Avg Position', val: gsc.position?.toFixed(1) ?? '—', delta: null },
                    ].map(m => (
                      <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-bold">{m.val}</p>
                        {m.delta}
                      </div>
                    ))}
                  </div>
                  {gsc.top_queries?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top 5 Queries</p>
                      <div className="rounded-md border overflow-hidden text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/30 border-b">
                              <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Query</th>
                              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Clicks</th>
                              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Impr.</th>
                              <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">CTR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gsc.top_queries.slice(0, 5).map((q: any) => (
                              <tr key={q.query} className="border-b last:border-0">
                                <td className="px-3 py-1.5 max-w-[200px] truncate">{q.query}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{q.clicks}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(q.impressions)}</td>
                                <td className={cn('px-3 py-1.5 text-right tabular-nums', q.impressions > 200 && q.ctr < 0.01 ? 'text-amber-500 font-semibold' : '')}>
                                  {pct(q.ctr * 100)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {gsc.top_queries.some((q: any) => q.impressions > 200 && q.ctr < 0.01) && (
                        <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                          <span>⚠</span> Queries with {'>'}200 impressions and {'<'}1% CTR highlighted — optimise these titles.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">No website data for this period.</p>}
        </DetailSection>

        {/* Spanish Site */}
        <DetailSection
          title="Spanish Site"
          icon={Globe}
          iconColor="text-orange-500"
          heroValue={fmt(ga4Es?.organic_sessions)}
          heroLabel="organic sessions"
          delta={<Delta current={ga4Es?.organic_sessions} prev={ga4Es?.organic_sessions_prev} />}
          oneLine={ga4Es
            ? `${fmt(ga4Es.organic_sessions)} sessions. ${gscEs ? `${fmt(gscEs.clicks)} GSC clicks.` : ''}`
            : 'No data for this period.'}
        >
          {(ga4Es || gscEs) ? (
            <div className="space-y-5">
              {ga4Es && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GA4 — ES Traffic</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Organic Sessions', val: fmt(ga4Es.organic_sessions), delta: <Delta current={ga4Es.organic_sessions} prev={ga4Es.organic_sessions_prev} /> },
                      { label: 'New Users', val: fmt(ga4Es.new_users), delta: null },
                      { label: 'Bounce Rate', val: pct(ga4Es.bounce_rate), delta: null },
                    ].map(m => (
                      <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-bold">{m.val}</p>
                        {m.delta}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {gscEs && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search Console — ES</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Clicks', val: fmt(gscEs.clicks), delta: <Delta current={gscEs.clicks} prev={gscEs.clicks_prev} /> },
                      { label: 'Impressions', val: fmt(gscEs.impressions), delta: null },
                      { label: 'CTR', val: pct(gscEs.ctr), delta: null },
                      { label: 'Avg Position', val: gscEs.position?.toFixed(1) ?? '—', delta: null },
                    ].map(m => (
                      <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-bold">{m.val}</p>
                        {m.delta}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">No Spanish site data for this period.</p>}
        </DetailSection>

        {/* Email */}
        <DetailSection
          title="Email (Brevo)"
          icon={Mail}
          iconColor="text-teal-500"
          heroValue={brevo ? pct(brevo.avg_open_rate) : '—'}
          heroLabel="avg open rate"
          delta={null}
          oneLine={brevoSummary}
        >
          {brevo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Avg Open Rate', val: pct(brevo.avg_open_rate) },
                  { label: 'Avg Click Rate', val: pct(brevo.avg_click_rate) },
                  { label: 'Avg CTOR', val: pct(brevo.avg_ctor) },
                ].map(m => (
                  <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-bold">{m.val}</p>
                  </div>
                ))}
              </div>
              {brevo.campaigns?.length > 0 && (
                <div className="rounded-md border overflow-hidden text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Campaign</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Open %</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Click %</th>
                        <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Unsub %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brevo.campaigns.slice(0, 5).map((c: any) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 max-w-[180px] truncate">{c.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(c.open_rate)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(c.click_rate)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(c.unsubscribe_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">No email data for this period.</p>}
        </DetailSection>

        {/* Leads */}
        <DetailSection
          title="Leads"
          icon={Users}
          iconColor="text-purple-500"
          heroValue={fmt(leads.total)}
          heroLabel="new leads"
          delta={null}
          oneLine={leadsSummary}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Leads', val: fmt(leads.total), color: 'text-foreground' },
                { label: 'Spam Filtered', val: fmt(leads.spam), color: 'text-red-500' },
                { label: 'High Value', val: fmt(leads.high_value), color: 'text-amber-500' },
              ].map(m => (
                <div key={m.label} className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className={cn('text-lg font-bold', m.color)}>{m.val}</p>
                </div>
              ))}
            </div>
            {leads.total > 0 && (
              <RechartsBar
                data={[
                  { name: 'Clean',      value: leads.total - leads.spam - leads.high_value },
                  { name: 'High Value', value: leads.high_value },
                  { name: 'Spam',       value: leads.spam },
                ]}
                color="#8B5CF6"
                label="Leads"
                height={120}
              />
            )}
          </div>
        </DetailSection>
      </section>
    </div>
  );
}
