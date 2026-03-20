import { getGoogleAuth } from './google-auth';
import type { YoutubeSnapshotData } from '@/types/database';

/**
 * Pull YouTube Analytics data for a channel over a date range.
 * Uses YouTube Analytics API v2 + YouTube Data API v3 for video details.
 */
export async function fetchYouTubeData(
  channelId: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<YoutubeSnapshotData> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('Missing YOUTUBE_API_KEY');

  const auth = getGoogleAuth();
  const { google } = await import('googleapis');

  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
  const youtube = google.youtube({ version: 'v3', auth });

  // Fetch current period metrics
  const [current, prev, videoReport] = await Promise.all([
    youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
      dimensions: 'day',
    }),
    youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: prevStartDate,
      endDate: prevEndDate,
      metrics: 'views,estimatedMinutesWatched',
    }),
    // Top videos by views in period
    youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'video',
      sort: '-views',
      maxResults: 10,
    }),
  ]);

  const rows = current.data.rows || [];
  let views = 0, watch_time_minutes = 0, subscribers_gained = 0, subscribers_lost = 0;
  const timeline: { date: string; views: number }[] = [];

  for (const row of rows) {
    const [date, v, wt, sg, sl] = row as [string, number, number, number, number];
    views += v || 0;
    watch_time_minutes += wt || 0;
    subscribers_gained += sg || 0;
    subscribers_lost += sl || 0;
    timeline.push({ date, views: v || 0 });
  }

  const prevRows = prev.data.rows || [];
  const views_prev = prevRows.reduce((s, r) => s + ((r as number[])[1] || 0), 0);
  const watch_time_prev = prevRows.reduce((s, r) => s + ((r as number[])[2] || 0), 0);

  // Get video details for top videos
  const videoRows = videoReport.data.rows || [];
  const videoIds = videoRows.map((r) => (r as string[])[0]).filter(Boolean);

  let top_videos: YoutubeSnapshotData['top_videos'] = [];
  if (videoIds.length > 0) {
    const details = await youtube.videos.list({
      part: ['snippet'],
      id: videoIds,
    });
    const detailMap = Object.fromEntries(
      (details.data.items || []).map((v) => [
        v.id!,
        { title: v.snippet?.title || '', thumbnail: v.snippet?.thumbnails?.medium?.url || '' },
      ])
    );
    top_videos = videoRows.slice(0, 10).map((row) => {
      const [video_id, v, wt] = row as [string, number, number];
      return {
        video_id,
        title: detailMap[video_id]?.title || video_id,
        thumbnail: detailMap[video_id]?.thumbnail || '',
        views: v || 0,
        watch_time_minutes: wt || 0,
      };
    });
  }

  return {
    views,
    views_prev,
    watch_time_minutes,
    watch_time_prev,
    subscribers_gained,
    subscribers_lost,
    net_subscribers: subscribers_gained - subscribers_lost,
    top_videos,
    timeline,
  };
}
