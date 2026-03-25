import Anthropic from '@anthropic-ai/sdk';
import type {
  MisPeriodTypeEnum,
  HighlightItem,
  GA4SnapshotData,
  GscSnapshotData,
  YoutubeSnapshotData,
  BrevoSnapshotData,
  MisSourceEnum,
} from '@/types/database';

interface SnapshotInput {
  source: MisSourceEnum;
  property: string;
  data: GA4SnapshotData | GscSnapshotData | YoutubeSnapshotData | BrevoSnapshotData;
}

/**
 * Generate AI highlights from the latest MIS snapshot data using Claude.
 * Returns 4–6 actionable insights tagged as WIN / PROBLEM / OPPORTUNITY / WATCH.
 */
export async function generateMisHighlights(
  snapshots: SnapshotInput[],
  periodType: MisPeriodTypeEnum,
  periodStart: string,
  periodEnd: string
): Promise<HighlightItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const client = new Anthropic({ apiKey });

  // Build a detailed data summary for the prompt
  const summaries = snapshots.map((s) => {
    const label = `${s.source.toUpperCase()}${s.property !== 'default' ? ` (${s.property})` : ''}`;

    if (s.source === 'youtube') {
      const d = s.data as YoutubeSnapshotData;
      const topVideo = d.top_videos[0];
      const avgViews = d.top_videos.length ? Math.round(d.views / d.top_videos.length) : 0;
      return `${label}:
  - Period views: ${d.views.toLocaleString()} across ${d.top_videos.length} recent videos
  - Channel total subscribers: ${d.net_subscribers.toLocaleString()}
  - Watch time: ${d.watch_time_minutes > 0 ? Math.round(d.watch_time_minutes / 60) + 'h' : 'not available (requires OAuth)'}
  - Avg views per video: ${avgViews.toLocaleString()}
  - Top video: "${topVideo?.title || 'N/A'}" with ${(topVideo?.views || 0).toLocaleString()} views
  - Other recent videos: ${d.top_videos.slice(1, 4).map(v => `"${v.title.slice(0, 40)}" (${v.views.toLocaleString()} views)`).join(', ') || 'none'}`;
    }

    if (s.source === 'ga4') {
      const d = s.data as GA4SnapshotData;
      const totalSessions = d.top_countries.reduce((sum, c) => sum + c.sessions, 0) || 1;
      const india = d.top_countries.find(c => c.country === 'India');
      const indiaPct = india ? Math.round((india.sessions / totalSessions) * 100) : 0;
      const newPct = Math.round((d.new_users / (d.new_users + d.returning_users || 1)) * 100);
      const deltaPct = d.organic_sessions_prev
        ? Math.round(((d.organic_sessions - d.organic_sessions_prev) / d.organic_sessions_prev) * 100)
        : null;
      return `${label}:
  - Organic sessions: ${d.organic_sessions.toLocaleString()} (prev: ${d.organic_sessions_prev.toLocaleString()}, ${deltaPct !== null ? (deltaPct >= 0 ? '+' : '') + deltaPct + '% change' : 'no prev data'})
  - New users: ${d.new_users.toLocaleString()} (${newPct}% of visitors)
  - Returning users: ${d.returning_users.toLocaleString()} (${100 - newPct}% of visitors)
  - Bounce rate: ${d.bounce_rate}%
  - India traffic: ${india?.sessions.toLocaleString() || 0} sessions (${indiaPct}% of total)
  - Top countries: ${d.top_countries.slice(0, 5).map(c => `${c.country}: ${c.sessions}`).join(', ')}`;
    }

    if (s.source === 'search_console') {
      const d = s.data as GscSnapshotData;
      const clickDelta = d.clicks_prev
        ? Math.round(((d.clicks - d.clicks_prev) / d.clicks_prev) * 100)
        : null;
      const ctrOpportunities = d.top_queries.filter(q => q.impressions > 500 && q.ctr < 1);
      return `${label}:
  - Clicks: ${d.clicks.toLocaleString()} (prev: ${d.clicks_prev.toLocaleString()}, ${clickDelta !== null ? (clickDelta >= 0 ? '+' : '') + clickDelta + '% change' : 'no prev data'})
  - Impressions: ${d.impressions.toLocaleString()}
  - Avg CTR: ${d.ctr}%
  - Avg position: ${d.position}
  - India: ${d.india?.clicks.toLocaleString() || 0} clicks, ${d.india?.impressions.toLocaleString() || 0} impressions, ${d.india?.ctr || 0}% CTR
  - CTR opportunity queries (impressions >500, CTR <1%): ${ctrOpportunities.length} queries — ${ctrOpportunities.slice(0, 3).map(q => `"${q.query}" (${q.impressions} imp, ${q.ctr}% CTR)`).join('; ') || 'none'}
  - Top queries: ${d.top_queries.slice(0, 5).map(q => `"${q.query}" (${q.clicks} clicks, ${q.ctr}% CTR)`).join(', ')}
  - Top pages by clicks: ${d.top_pages.slice(0, 3).map(p => `${p.page.replace(/^https?:\/\/[^/]+/, '')} (${p.clicks} clicks, ${p.impressions} imp)`).join(', ')}`;
    }

    if (s.source === 'brevo') {
      const d = s.data as BrevoSnapshotData;
      const flagged = d.campaigns.filter(c => c.unsubscribe_rate > 0.5);
      const B2B_OPEN_BENCHMARK = 22;
      return `${label}:
  - Campaigns sent: ${d.campaigns.length}
  - Avg open rate: ${d.avg_open_rate}% (B2B benchmark: ${B2B_OPEN_BENCHMARK}%)
  - Avg click rate: ${d.avg_click_rate}%
  - Avg CTOR: ${d.avg_ctor}%
  - Campaigns with >0.5% unsubscribe: ${flagged.length}${flagged.length > 0 ? ` (${flagged.map(c => c.name).join(', ')})` : ''}
  - Individual campaigns: ${d.campaigns.slice(0, 5).map(c => `"${c.name}" — open: ${c.open_rate}%, click: ${c.click_rate}%, unsub: ${c.unsubscribe_rate}%`).join(' | ')}`;
    }

    return `${label}: data available`;
  }).join('\n\n');

  const systemPrompt = `You are a senior digital marketing analyst reviewing ${periodType} performance data for Axis India (axis-india.com), a B2B industrial technology company based in India that manufactures electrical components including cable glands, earthing systems, and lightning arresters. Their marketing is primarily a branding and inbound lead generation activity. They sell to distributors, electrical contractors, and industrial buyers primarily in India but also internationally.

You are given a snapshot of their marketing data for the current period vs the previous period across YouTube, Google Analytics, Google Search Console (main site + Spanish site), and Brevo email.

Generate 4-6 highlights. Each highlight must:
1. State what happened in plain English (not just repeat the number)
2. Explain WHY this likely happened or what it means for their business specifically
3. If it is a problem or opportunity, state what specific action they should take
4. Be tagged as one of: WIN / PROBLEM / OPPORTUNITY / WATCH

Do NOT generate highlights that just say "X metric increased by Y%". Every highlight must contain an interpretation or recommendation.

Examples of BAD highlights:
- "Search Console clicks increased 404% this week"
- "YouTube recorded 7,761 views"

Examples of GOOD highlights:
- "OPPORTUNITY: Your earthing systems pages have 22,000 impressions but only 0.4% CTR — you rank well but people aren't clicking. Rewriting the meta titles to include specific product names and standards (like IEC 62305) could double your clicks without any ranking work."
- "WIN: The 'Are You Crimping Your Bimetallic Lugs The Wrong Way?' video drove 1,253 views — your problem-focused titles are outperforming generic product titles. Apply this format to your next 3 videos."
- "WATCH: Zero watch time hours recorded despite 7,761 views suggests a YouTube Analytics API tracking issue, not a real drop. Check your YouTube Studio directly to confirm."

Respond with ONLY valid JSON — an array of objects with these exact fields:
[
  {
    "id": "unique-string",
    "source": "ga4|search_console|youtube|brevo",
    "text": "The full highlight text — must be 2-4 sentences with interpretation and recommended action.",
    "sentiment": "positive|warning|anomaly",
    "tag": "WIN|PROBLEM|OPPORTUNITY|WATCH",
    "data_points": ["Specific number 1", "Specific number 2"]
  }
]

Tag mapping guide:
- WIN: something is performing well above expectations — celebrate and learn from it
- PROBLEM: something is broken, declining significantly, or needs immediate attention
- OPPORTUNITY: something is within reach but currently underperforming — specific action will improve it
- WATCH: something is unusual, ambiguous, or worth monitoring — not yet good or bad`;

  const userPrompt = `Analyze this ${periodType} marketing data (${periodStart} to ${periodEnd}) and generate 4–6 highlights:

${summaries}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  try {
    const raw = content.text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(raw) as HighlightItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [{
      id: 'fallback-1',
      source: 'ga4',
      text: 'Marketing data has been collected for this period. Highlights could not be parsed — check logs.',
      sentiment: 'anomaly',
      tag: 'WATCH',
    }];
  }
}
