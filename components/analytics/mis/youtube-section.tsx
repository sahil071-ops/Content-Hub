'use client';

import { ExternalLink } from 'lucide-react';
import { RechartsLine } from '@/components/analytics/recharts-line';
import { cn } from '@/lib/utils';
import type { YoutubeSnapshotData } from '@/types/database';

interface YouTubeSectionProps {
  data: YoutubeSnapshotData;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function YouTubeSection({ data }: YouTubeSectionProps) {
  const topVideo = data.top_videos[0];
  const videoCount = data.top_videos.length || 1;
  const avgViews = Math.round(data.views / videoCount);

  // Auto-summary
  const summary = topVideo
    ? `${fmt(data.views)} views across ${data.top_videos.length} recent videos. Best performer: "${topVideo.title.slice(0, 50)}${topVideo.title.length > 50 ? '…' : ''}" with ${fmt(topVideo.views)} views.`
    : `${fmt(data.views)} total views this period. No top video data available.`;

  return (
    <div className="space-y-6 pt-4">
      {/* Auto-summary */}
      <p className="text-sm text-muted-foreground italic border-l-4 border-red-500 pl-3 py-1">{summary}</p>

      {/* Hero + secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Views This Period</p>
          <p className="text-2xl font-bold">{fmt(data.views)}</p>
          <p className="text-xs text-muted-foreground mt-1">Recent {data.top_videos.length} videos</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Views / Video</p>
          <p className="text-2xl font-bold">{fmt(avgViews)}</p>
        </div>
        {data.watch_time_minutes > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Watch Time</p>
            <p className="text-2xl font-bold">{Math.round(data.watch_time_minutes / 60)}h</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-card/50 p-4 flex items-center">
            <p className="text-xs text-muted-foreground">
              Subscriber &amp; watch time data requires YouTube account connection — set up in Admin Settings.
            </p>
          </div>
        )}
      </div>

      {/* Top 5 videos — visual bar-list */}
      {data.top_videos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Top 5 Videos by Views
          </h3>
          <div className="space-y-2">
            {data.top_videos.slice(0, 5).map((v, i) => {
              const pct = topVideo ? Math.round((v.views / topVideo.views) * 100) : 0;
              return (
                <div key={v.video_id} className="flex items-start gap-3 group">
                  {/* Thumbnail */}
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      className="h-14 w-24 object-cover rounded shrink-0 border"
                    />
                  ) : (
                    <div className="h-14 w-24 bg-muted rounded shrink-0 flex items-center justify-center text-muted-foreground text-xs">
                      #{i + 1}
                    </div>
                  )}
                  {/* Info + bar */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                        {v.title.slice(0, 60)}{v.title.length > 60 ? '…' : ''}
                      </p>
                      <a
                        href={`https://youtube.com/watch?v=${v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Open on YouTube"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-semibold text-red-600">{fmt(v.views)} views</span>
                      {v.watch_time_minutes > 0 && (
                        <span className="text-xs text-muted-foreground">{Math.round(v.watch_time_minutes / 60)}h watch time</span>
                      )}
                    </div>
                    {/* Mini bar */}
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Views timeline */}
      {data.timeline.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Views Per Day
          </h3>
          <RechartsLine
            data={data.timeline}
            series={[{ key: 'views', label: 'Views', color: '#FF0000' }]}
            height={220}
          />
        </div>
      )}

      {data.timeline.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
          Day-by-day timeline requires YouTube Analytics API (OAuth). Not available with API key only.
        </p>
      )}
    </div>
  );
}
