import type { BrevoSnapshotData } from '@/types/database';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

interface BrevoEmailCampaign {
  id: number;
  name: string;
  subject: string;
  type: string;
  status: string;
  scheduledAt?: string;
  sentDate?: string;
  statistics?: {
    globalStats?: {
      sent?: number;
      openRate?: number;
      clickRate?: number;
      clicker?: number;
      unsubscribed?: number;
    };
    campaignStats?: Array<{
      openRate?: number;
      clickRate?: number;
      uniqueClicks?: number;
    }>;
  };
}

async function brevoGet(path: string): Promise<unknown> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('Missing BREVO_API_KEY');

  const url = `${BREVO_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'api-key': apiKey,      // Brevo v3 API requires exactly this header name
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    throw new Error(
      `Brevo API ${res.status} at ${path}: ${body.slice(0, 500)}`
    );
  }
  return res.json();
}

/**
 * Fetch Brevo email campaign stats for campaigns sent within the given date range.
 */
export async function fetchBrevoData(
  startDate: string,
  endDate: string
): Promise<BrevoSnapshotData> {
  // List sent campaigns in date range
  const params = new URLSearchParams({
    type: 'classic',
    status: 'sent',
    startDate,
    endDate,
    limit: '50',
    offset: '0',
  });

  const listRes = await brevoGet(`/emailCampaigns?${params}`) as {
    campaigns: BrevoEmailCampaign[];
    count: number;
  };

  const campaigns = listRes.campaigns || [];

  const processedCampaigns: BrevoSnapshotData['campaigns'] = campaigns.map((c) => {
    const stats = c.statistics?.globalStats || {};
    const sent = stats.sent || 0;
    const unsubscribed = stats.unsubscribed || 0;
    const open_rate = (stats.openRate || 0) * 100;
    const click_rate = (stats.clickRate || 0) * 100;
    // CTOR = clicks / opens
    const ctor = open_rate > 0 ? Math.round((click_rate / open_rate) * 10000) / 100 : 0;
    const unsubscribe_rate = sent > 0 ? Math.round((unsubscribed / sent) * 10000) / 100 : 0;

    return {
      id: String(c.id),
      name: c.name,
      send_date: c.sentDate || c.scheduledAt || '',
      sent_count: sent,
      open_rate: Math.round(open_rate * 100) / 100,
      click_rate: Math.round(click_rate * 100) / 100,
      ctor,
      unsubscribe_count: unsubscribed,
      unsubscribe_rate,
    };
  });

  const n = processedCampaigns.length || 1;
  const avg_open_rate =
    Math.round(processedCampaigns.reduce((s, c) => s + c.open_rate, 0) / n * 100) / 100;
  const avg_click_rate =
    Math.round(processedCampaigns.reduce((s, c) => s + c.click_rate, 0) / n * 100) / 100;
  const avg_ctor =
    Math.round(processedCampaigns.reduce((s, c) => s + c.ctor, 0) / n * 100) / 100;

  return {
    campaigns: processedCampaigns,
    avg_open_rate,
    avg_click_rate,
    avg_ctor,
  };
}
