import { google } from 'googleapis';
import { getGoogleAuth } from './google-auth';
import type { GscSnapshotData } from '@/types/database';

/**
 * Pull Google Search Console data for a site URL over a date range.
 * Returns clicks, impressions, CTR, position, top queries and pages.
 * Optionally filters for India-specific data.
 */
export async function fetchSearchConsoleData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<GscSnapshotData> {
  const auth = getGoogleAuth();
  const sc = google.searchconsole({ version: 'v1', auth });

  // Helper to run a query
  async function query(body: object) {
    const res = await sc.searchanalytics.query({
      siteUrl,
      requestBody: body as any,
    });
    return res.data.rows || [];
  }

  const [overallRows, prevRows, queryRows, pageRows, indiaQueryRows] = await Promise.all([
    // Overall totals
    query({ startDate, endDate, dimensions: ['date'], rowLimit: 500 }),
    // Previous period totals
    query({ startDate: prevStartDate, endDate: prevEndDate, dimensions: ['date'], rowLimit: 1 }),
    // Top queries
    query({ startDate, endDate, dimensions: ['query'], rowLimit: 20 }),
    // Top pages
    query({ startDate, endDate, dimensions: ['page'], rowLimit: 20 }),
    // India queries
    query({
      startDate,
      endDate,
      dimensions: ['query'],
      dimensionFilterGroups: [{
        filters: [{ dimension: 'country', operator: 'equals', expression: 'ind' }],
      }],
      rowLimit: 10,
    }),
  ]);

  // Aggregate overall totals
  let clicks = 0, impressions = 0, ctr = 0, position = 0;
  for (const row of overallRows) {
    clicks += row.clicks || 0;
    impressions += row.impressions || 0;
    ctr += row.ctr || 0;
    position += row.position || 0;
  }
  const n = overallRows.length || 1;

  // Prev period
  const clicks_prev = prevRows.reduce((s, r) => s + (r.clicks || 0), 0);

  const top_queries = queryRows
    .map((r) => ({
      query: (r.keys?.[0] as string) || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 10000) / 100,
      position: Math.round((r.position || 0) * 10) / 10,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const top_pages = pageRows
    .map((r) => ({
      page: (r.keys?.[0] as string) || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // India-specific
  let indiaClicks = 0, indiaImpressions = 0, indiaCtr = 0, indiaPosition = 0;
  for (const row of indiaQueryRows) {
    indiaClicks += row.clicks || 0;
    indiaImpressions += row.impressions || 0;
    indiaCtr += row.ctr || 0;
    indiaPosition += row.position || 0;
  }
  const ni = indiaQueryRows.length || 1;

  const india_top_queries = indiaQueryRows
    .map((r) => ({
      query: (r.keys?.[0] as string) || '',
      clicks: r.clicks || 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return {
    clicks,
    clicks_prev,
    impressions,
    impressions_prev: 0, // Not fetched separately; easy to add
    ctr: Math.round((ctr / n) * 10000) / 100,
    position: Math.round((position / n) * 10) / 10,
    top_queries,
    top_pages,
    india: {
      clicks: indiaClicks,
      impressions: indiaImpressions,
      ctr: Math.round((indiaCtr / ni) * 10000) / 100,
      position: Math.round((indiaPosition / ni) * 10) / 10,
      top_queries: india_top_queries,
    },
  };
}
