'use client';

import { MetricCard } from '@/components/analytics/metric-card';
import { RechartsLine } from '@/components/analytics/recharts-line';
import type { YoutubeSnapshotData } from '@/types/database';

interface YouTubeSectionProps {
  data: YoutubeSnapshotData;
}

export function YouTubeSection({ data }: YouTubeSectionProps) {
  return (
    <div className="space-y-5 pt-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Views" value={data.views} prev={data.views_prev} />
        <MetricCard label="Net Subscribers" value={data.net_subscribers} />
        <MetricCard label="Watch Time" value={Math.round(data.watch_time_minutes / 60)} prev={Math.round(data.watch_time_prev / 60)} unit="hrs" />
        <MetricCard label="Subs Gained" value={data.subscribers_gained} />
      </div>

      {/* Views timeline */}
      {data.timeline.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Views Over Time</h3>
          <RechartsLine
            data={data.timeline}
            series={[{ key: 'views', label: 'Views', color: '#FF0004' }]}
            height={200}
          />
        </div>
      )}

      {/* Top videos */}
      {data.top_videos.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top Videos</h3>
          <div className="space-y-2">
            {data.top_videos.slice(0, 5).map((v) => (
              <div key={v.video_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt={v.title} className="h-12 w-20 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.views.toLocaleString()} views · {Math.round(v.watch_time_minutes / 60)}h watch time</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
