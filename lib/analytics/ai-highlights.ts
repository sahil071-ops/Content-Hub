import Anthropic from '@anthropic-ai/sdk';
import type {
  MisPeriodTypeEnum,
  MisSourceEnum,
  HighlightItem,
  GA4SnapshotData,
  GscSnapshotData,
  YoutubeSnapshotData,
  BrevoSnapshotData,
} from '@/types/database';

interface SnapshotInput {
  source: MisSourceEnum;
  property: string;
  data: GA4SnapshotData | GscSnapshotData | YoutubeSnapshotData | BrevoSnapshotData;
}

/**
 * Generate AI highlights from the latest MIS snapshot data using Claude.
 * Returns 3–5 plain-English insights with source tags and sentiment.
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

  // Build a compact summary of the data for the prompt
  const summaries = snapshots.map((s) => {
    const label = `${s.source.toUpperCase()}${s.property !== 'default' ? ` (${s.property})` : ''}`;

    if (s.source === 'youtube') {
      const d = s.data as YoutubeSnapshotData;
      return `${label}: ${d.views} views (prev: ${d.views_prev}), ${d.net_subscribers} net subscribers, ${Math.round(d.watch_time_minutes / 60)} hours watch time. Top video: "${d.top_videos[0]?.title || 'N/A'}" with ${d.top_videos[0]?.views || 0} views.`;
    }
    if (s.source === 'ga4') {
      const d = s.data as GA4SnapshotData;
      return `${label}: ${d.organic_sessions} organic sessions (prev: ${d.organic_sessions_prev}), ${d.new_users} new users, ${d.returning_users} returning. Top country: ${d.top_countries[0]?.country || 'N/A'}.`;
    }
    if (s.source === 'search_console') {
      const d = s.data as GscSnapshotData;
      return `${label}: ${d.clicks} clicks (prev: ${d.clicks_prev}), ${d.impressions} impressions, ${d.ctr}% CTR, avg position ${d.position}. India: ${d.india?.clicks || 0} clicks.`;
    }
    if (s.source === 'brevo') {
      const d = s.data as BrevoSnapshotData;
      const flagged = d.campaigns.filter((c) => c.unsubscribe_rate > 0.5);
      return `${label}: ${d.campaigns.length} campaigns sent. Avg open: ${d.avg_open_rate}%, avg click: ${d.avg_click_rate}%, avg CTOR: ${d.avg_ctor}%. ${flagged.length > 0 ? `⚠ ${flagged.length} campaign(s) exceeded 0.5% unsubscribe rate.` : ''}`;
    }
    return `${label}: data available`;
  }).join('\n');

  const prompt = `You are a marketing analytics assistant for Axis, an electrical products company selling globally.
Analyze the following ${periodType} marketing data (${periodStart} to ${periodEnd}) and generate 3–5 plain-English highlights.

DATA SUMMARY:
${summaries}

Rules:
- Each highlight must be ONE clear sentence.
- Focus on significant changes, anomalies, or wins.
- Be specific — include numbers and % changes when relevant.
- If something dropped significantly, flag it as a warning.
- If something grew significantly (>20%), highlight it as positive.
- Anomalies are things that are unexpected or need investigation.

Respond with ONLY valid JSON — an array of objects with these fields:
[
  {
    "id": "unique-string",
    "source": "ga4|search_console|youtube|brevo",
    "text": "The highlight sentence here.",
    "sentiment": "positive|warning|anomaly"
  }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') return [];

  try {
    // Strip any markdown code fences
    const raw = content.text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(raw) as HighlightItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    // Return a fallback if Claude returns invalid JSON
    return [{
      id: 'fallback-1',
      source: 'ga4',
      text: 'Analytics data has been collected for this period.',
      sentiment: 'positive',
    }];
  }
}
