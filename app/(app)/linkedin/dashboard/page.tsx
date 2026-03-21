'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Eye, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { LinkedInPost, LinkedInAccount } from '@/types/database';

const COLOURS = ['#2323A3', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
const FORMAT_COLOURS: Record<string, string> = {
  text: '#64748b',
  image: '#7C3AED',
  video: '#DC2626',
  carousel: '#2323A3',
  document: '#D97706',
  poll: '#059669',
  other: '#6B7280',
};

interface DashboardData {
  accounts: LinkedInAccount[];
  posts: LinkedInPost[];
}

export default function LinkedInDashboardPage() {
  const [data, setData] = useState<DashboardData>({ accounts: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('90');
  const [selectedAccount, setSelectedAccount] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(period));
        const sinceStr = since.toISOString().split('T')[0];

        const [postsRes, accRes] = await Promise.all([
          fetch(`/api/linkedin/posts?status=published&from_date=${sinceStr}`),
          fetch('/api/linkedin/accounts'),
        ]);

        const { posts } = await postsRes.json();
        const { accounts } = await accRes.json();
        setData({ posts: posts || [], accounts: accounts || [] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  const filteredPosts = selectedAccount === 'all'
    ? data.posts
    : data.posts.filter(p => p.account_id === selectedAccount);

  // ── Scorecards ──────────────────────────────────────────────
  const totalImpressions = filteredPosts.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const totalReactions = filteredPosts.reduce((s, p) => s + (p.reactions ?? 0), 0);
  const totalComments = filteredPosts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const totalShares = filteredPosts.reduce((s, p) => s + (p.shares ?? 0), 0);
  const avgEngagement = filteredPosts.filter(p => p.engagement_rate !== null).length > 0
    ? filteredPosts.filter(p => p.engagement_rate !== null)
        .reduce((s, p) => s + p.engagement_rate!, 0) /
      filteredPosts.filter(p => p.engagement_rate !== null).length
    : null;

  // ── Impressions over time (all accounts) ────────────────────
  const impressionsByDate = buildTimeSeriesData(filteredPosts, data.accounts, 'impressions');

  // ── Engagement rate over time ────────────────────────────────
  const engagementByDate = buildTimeSeriesData(filteredPosts, data.accounts, 'engagement_rate');

  // ── Format distribution (pie) ────────────────────────────────
  const formatCounts = filteredPosts.reduce<Record<string, number>>((acc, p) => {
    acc[p.post_format] = (acc[p.post_format] || 0) + 1;
    return acc;
  }, {});
  const formatPieData = Object.entries(formatCounts).map(([name, value]) => ({ name, value }));

  // ── Format vs avg engagement (bar) ──────────────────────────
  const formatEngagement = buildFormatEngagementData(filteredPosts);

  // ── Topic tag performance ────────────────────────────────────
  const topicData = buildTopicData(filteredPosts).slice(0, 10);

  // ── Scatter: impressions vs engagement ──────────────────────
  const scatterData = filteredPosts
    .filter(p => p.impressions !== null && p.engagement_rate !== null)
    .map(p => ({
      impressions: p.impressions!,
      engagement: p.engagement_rate!,
      format: p.post_format,
    }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">LinkedIn Dashboard</h1>
          <p className="text-sm text-muted-foreground">{filteredPosts.length} posts in selected period</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {data.accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="icon" variant="ghost" onClick={() => setPeriod(p => p)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <ScoreCard label="Total Posts" value={filteredPosts.length.toLocaleString()} icon={TrendingUp} />
        <ScoreCard label="Impressions" value={totalImpressions.toLocaleString()} icon={Eye} />
        <ScoreCard label="Reactions" value={totalReactions.toLocaleString()} icon={ThumbsUp} />
        <ScoreCard label="Comments" value={totalComments.toLocaleString()} icon={MessageSquare} />
        <ScoreCard
          label="Avg Engagement"
          value={avgEngagement !== null ? `${avgEngagement.toFixed(2)}%` : '—'}
          icon={Share2}
          highlight={avgEngagement !== null && avgEngagement >= 3}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Impressions over time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Impressions Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={impressionsByDate} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.accounts.map((a, i) => (
                      <Line
                        key={a.id}
                        type="monotone"
                        dataKey={a.name}
                        stroke={COLOURS[i % COLOURS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Engagement rate over time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Engagement Rate Over Time (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={engagementByDate} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} unit="%" />
                    <Tooltip formatter={(v: any) => `${(+v).toFixed(2)}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.accounts.map((a, i) => (
                      <Line
                        key={a.id}
                        type="monotone"
                        dataKey={a.name}
                        stroke={COLOURS[i % COLOURS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Format distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Post Format Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={formatPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {formatPieData.map((entry) => (
                        <Cell key={entry.name} fill={FORMAT_COLOURS[entry.name] || '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Format vs avg engagement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avg Engagement by Format</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={formatEngagement} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="format" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" width={35} />
                    <Tooltip formatter={(v: any) => `${(+v).toFixed(2)}%`} />
                    <Bar dataKey="avg_engagement" radius={[3, 3, 0, 0]}>
                      {formatEngagement.map((entry) => (
                        <Cell key={entry.format} fill={FORMAT_COLOURS[entry.format] || '#6B7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Topic performance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Topics by Avg Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topicData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="topic" tick={{ fontSize: 10 }} tickLine={false} width={80} />
                    <Tooltip formatter={(v: any) => `${(+v).toFixed(2)}%`} />
                    <Bar dataKey="avg_engagement" fill="#2323A3" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Scatter plot */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Impressions vs Engagement Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="impressions" type="number" name="Impressions" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis dataKey="engagement" type="number" name="Eng. Rate" unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v: any, name: any) => [
                      name === 'engagement' ? `${(+v).toFixed(2)}%` : (+v).toLocaleString(),
                      name === 'engagement' ? 'Eng. Rate' : 'Impressions',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Object.keys(FORMAT_COLOURS).map((fmt) => (
                    <Scatter
                      key={fmt}
                      name={fmt}
                      data={scatterData.filter(d => d.format === fmt)}
                      fill={FORMAT_COLOURS[fmt]}
                      opacity={0.7}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-account breakdown */}
          {selectedAccount === 'all' && data.accounts.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Per-Account Breakdown</h2>
              {data.accounts.map((account) => {
                const accountPosts = data.posts.filter(p => p.account_id === account.id);
                if (accountPosts.length === 0) return null;
                const accAvgEng = accountPosts.filter(p => p.engagement_rate !== null).length > 0
                  ? accountPosts.filter(p => p.engagement_rate !== null)
                      .reduce((s, p) => s + p.engagement_rate!, 0) /
                    accountPosts.filter(p => p.engagement_rate !== null).length
                  : null;
                const accImpressions = accountPosts.reduce((s, p) => s + (p.impressions ?? 0), 0);

                return (
                  <Card key={account.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{account.name}</span>
                        <div className="flex gap-4 text-xs font-normal text-muted-foreground">
                          <span>{accountPosts.length} posts</span>
                          <span>{accImpressions.toLocaleString()} impressions</span>
                          {accAvgEng !== null && <span>Avg {accAvgEng.toFixed(2)}% engagement</span>}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                          data={accountPosts
                            .sort((a, b) => a.post_date.localeCompare(b.post_date))
                            .slice(-20)
                            .map(p => ({
                              date: p.post_date.slice(5),
                              impressions: p.impressions ?? 0,
                              engagement: p.engagement_rate ?? 0,
                            }))}
                          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar dataKey="impressions" fill="#2323A3" radius={[2, 2, 0, 0]} opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────
function ScoreCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-emerald-500' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={cn('text-xl font-bold tabular-nums', highlight && 'text-emerald-600')}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Data helpers ────────────────────────────────────────────────
function buildTimeSeriesData(posts: LinkedInPost[], accounts: LinkedInAccount[], metric: 'impressions' | 'engagement_rate') {
  // Group posts by week + account
  const byWeek: Record<string, Record<string, number[]>> = {};

  for (const post of posts) {
    const d = new Date(post.post_date + 'T00:00:00');
    // ISO week start
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    const week = d.toISOString().split('T')[0];

    if (!byWeek[week]) byWeek[week] = {};
    const value = post[metric];
    if (value !== null && value !== undefined) {
      if (!byWeek[week][post.account_id]) byWeek[week][post.account_id] = [];
      byWeek[week][post.account_id].push(value as number);
    }
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, accs]) => {
      const row: Record<string, any> = { date: date.slice(5) };
      for (const account of accounts) {
        const vals = accs[account.id] || [];
        if (vals.length > 0) {
          row[account.name] = metric === 'engagement_rate'
            ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
            : vals.reduce((a, b) => a + b, 0);
        }
      }
      return row;
    });
}

function buildFormatEngagementData(posts: LinkedInPost[]) {
  const byFormat: Record<string, number[]> = {};
  for (const p of posts) {
    if (p.engagement_rate !== null) {
      if (!byFormat[p.post_format]) byFormat[p.post_format] = [];
      byFormat[p.post_format].push(p.engagement_rate);
    }
  }
  return Object.entries(byFormat).map(([format, rates]) => ({
    format,
    avg_engagement: +(rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2),
    count: rates.length,
  })).sort((a, b) => b.avg_engagement - a.avg_engagement);
}

function buildTopicData(posts: LinkedInPost[]) {
  const byTopic: Record<string, number[]> = {};
  for (const p of posts) {
    if (p.engagement_rate !== null) {
      for (const tag of p.topic_tags) {
        if (!byTopic[tag]) byTopic[tag] = [];
        byTopic[tag].push(p.engagement_rate);
      }
    }
  }
  return Object.entries(byTopic)
    .map(([topic, rates]) => ({
      topic,
      avg_engagement: +(rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2),
      count: rates.length,
    }))
    .filter(d => d.count >= 2)
    .sort((a, b) => b.avg_engagement - a.avg_engagement);
}
