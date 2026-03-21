import type { YoutubeSnapshotData } from '@/types/database';

/**
 * Pull YouTube channel data using the YouTube Data API v3 with an API key.
 *
 * NOTE: YouTube Analytics API v2 requires OAuth 2.0 user credentials and
 * cannot be used with a service account for regular YouTube channels.
 * We use the public YouTube Data API v3 (API key only) instead, which gives
 * us channel-level statistics and top video stats without OAuth.
 */
export async function fetchYouTubeData(
  channelId: string,
  _startDate: string,
  _endDate: string,
  _prevStartDate: string,
  _prevEndDate: string
): Promise<YoutubeSnapshotData> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('Missing YOUTUBE_API_KEY');

  const base = 'https://www.googleapis.com/youtube/v3';

  // ── Channel statistics + uploads playlist ID ───────────────
  const channelRes = await fetch(
    `${base}/channels?part=statistics,contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`
  );
  if (!channelRes.ok) {
    const text = await channelRes.text();
    throw new Error(`YouTube channels API error ${channelRes.status}: ${text}`);
  }
  const channelJson = await channelRes.json() as {
    items?: {
      statistics: {
        viewCount?: string;
        subscriberCount?: string;
        videoCount?: string;
      };
      contentDetails: {
        relatedPlaylists: { uploads?: string };
      };
    }[];
  };

  if (!channelJson.items?.length) {
    throw new Error(`Channel not found: ${channelId}. Check YOUTUBE_CHANNEL_ID.`);
  }

  const stats = channelJson.items[0].statistics;
  const uploadsPlaylistId = channelJson.items[0].contentDetails.relatedPlaylists.uploads;

  const totalViews = parseInt(stats.viewCount || '0', 10);

  // ── Latest videos from uploads playlist ───────────────────
  let top_videos: YoutubeSnapshotData['top_videos'] = [];

  if (uploadsPlaylistId) {
    // Get the 20 most recent videos
    const playlistRes = await fetch(
      `${base}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`
    );
    if (playlistRes.ok) {
      const playlistJson = await playlistRes.json() as {
        items?: { snippet: { resourceId: { videoId: string }; title: string; thumbnails?: { medium?: { url: string } } } }[];
      };
      const videoIds = (playlistJson.items || [])
        .map((item) => item.snippet.resourceId.videoId)
        .filter(Boolean);

      if (videoIds.length > 0) {
        // Get view counts for these videos
        const videoStatsRes = await fetch(
          `${base}/videos?part=statistics,snippet&id=${videoIds.join(',')}&key=${apiKey}`
        );
        if (videoStatsRes.ok) {
          const videoStatsJson = await videoStatsRes.json() as {
            items?: {
              id: string;
              snippet: { title: string; thumbnails?: { medium?: { url: string } } };
              statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
            }[];
          };

          top_videos = (videoStatsJson.items || [])
            .map((v) => ({
              video_id: v.id,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails?.medium?.url || '',
              views: parseInt(v.statistics.viewCount || '0', 10),
              watch_time_minutes: 0, // Not available without YouTube Analytics OAuth
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);
        }
      }
    }
  }

  const periodViews = top_videos.reduce((sum, v) => sum + v.views, 0);

  return {
    views: periodViews,
    views_prev: 0, // Not available without YouTube Analytics OAuth
    watch_time_minutes: 0,
    watch_time_prev: 0,
    subscribers_gained: 0,
    subscribers_lost: 0,
    net_subscribers: 0,
    top_videos,
    timeline: [], // Time-series requires YouTube Analytics OAuth — not available via API key
    // Extra channel-level totals stored for context
    ...(totalViews && { channel_total_views: totalViews }),
  } as YoutubeSnapshotData;
}
