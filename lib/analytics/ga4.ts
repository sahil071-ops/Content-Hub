import { google } from 'googleapis';
import { getGoogleAuth } from './google-auth';
import type { GA4SnapshotData } from '@/types/database';

/**
 * Pull GA4 data for a property over a date range.
 * Returns organic-only sessions, new/returning split, top countries, and timeline.
 */
export async function fetchGA4Data(
  propertyId: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<GA4SnapshotData> {
  const auth = getGoogleAuth();
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  // Current period
  const current = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'country' }, { name: 'newVsReturning' }, { name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'bounceRate' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionMedium',
          stringFilter: { matchType: 'EXACT', value: 'organic' },
        },
      },
      limit: '1000',
    },
  });

  // Previous period for comparison
  const prev = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionMedium',
          stringFilter: { matchType: 'EXACT', value: 'organic' },
        },
      },
      limit: '1',
    },
  });

  const rows = current.data.rows || [];
  const prevRows = prev.data.rows || [];

  let organic_sessions = 0;
  let new_users = 0;
  let returning_users = 0;
  let bounce_rate = 0;
  let bounceCount = 0;
  const countryMap: Record<string, number> = {};
  const dateMap: Record<string, number> = {};

  for (const row of rows) {
    const country = row.dimensionValues?.[0]?.value || 'Unknown';
    const newVsRet = row.dimensionValues?.[1]?.value || '';
    const date = row.dimensionValues?.[2]?.value || '';
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const br = parseFloat(row.metricValues?.[1]?.value || '0');

    organic_sessions += sessions;
    if (newVsRet === 'new') new_users += sessions;
    else returning_users += sessions;
    if (br > 0) { bounce_rate += br; bounceCount++; }
    countryMap[country] = (countryMap[country] || 0) + sessions;
    dateMap[date] = (dateMap[date] || 0) + sessions;
  }

  const organic_sessions_prev = prevRows.reduce(
    (sum, r) => sum + parseInt(r.metricValues?.[0]?.value || '0', 10),
    0
  );

  const top_countries = Object.entries(countryMap)
    .map(([country, sessions]) => ({ country, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  const timeline = Object.entries(dateMap)
    .map(([date, sessions]) => ({ date, sessions }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    organic_sessions,
    organic_sessions_prev,
    new_users,
    returning_users,
    bounce_rate: bounceCount > 0 ? Math.round((bounce_rate / bounceCount) * 100) / 100 : 0,
    top_countries,
    timeline,
  };
}
