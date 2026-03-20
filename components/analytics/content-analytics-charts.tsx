'use client';

import { useState } from 'react';
import { RechartsBar } from './recharts-bar';
import { RechartsDonut } from './recharts-donut';
import { RechartsLine } from './recharts-line';
import { Button } from '@/components/ui/button';

interface ContentAnalyticsChartsProps {
  productCounts: Record<string, number>;
  topicCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  audienceCounts: Record<string, number>;
  monthlyTimeline: Record<string, number>;
}

export function ContentAnalyticsCharts({
  productCounts,
  topicCounts,
  typeCounts,
  audienceCounts,
  monthlyTimeline,
}: ContentAnalyticsChartsProps) {
  const [timelineView, setTimelineView] = useState<'month' | 'week'>('month');

  const productData = Object.entries(productCounts)
    .map(([name, value]) => ({ name, value, filter: name }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const topicData = Object.entries(topicCounts)
    .map(([name, value]) => ({ name, value, filter: name }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const typeData = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value, filter: name }))
    .sort((a, b) => b.value - a.value);

  const audienceData = Object.entries(audienceCounts)
    .map(([name, value]) => ({ name, value, filter: name }))
    .sort((a, b) => b.value - a.value);

  const timelineData = Object.entries(monthlyTimeline)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Distribution Charts
        <span className="ml-2 text-xs font-normal normal-case">Click any bar or slice to view those items</span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product distribution */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">By Product</h3>
          <RechartsBar data={productData} filterKey="product" horizontal label="Items" />
        </div>

        {/* Content type donut */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Content Type Breakdown</h3>
          <RechartsDonut data={typeData} filterKey="type" />
        </div>

        {/* Topic distribution */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">By Topic</h3>
          <RechartsBar data={topicData} filterKey="topic" color="#59A7F1" horizontal label="Items" />
        </div>

        {/* Audience coverage */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Audience Coverage</h3>
          <RechartsBar data={audienceData} filterKey="audience" color="#4ECDC4" label="Items" />
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Output Over Time</h3>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={timelineView === 'month' ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => setTimelineView('month')}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={timelineView === 'week' ? 'default' : 'outline'}
              className="h-7 text-xs px-2"
              onClick={() => setTimelineView('week')}
            >
              Weekly
            </Button>
          </div>
        </div>
        <RechartsLine
          data={timelineData}
          series={[{ key: 'count', label: 'Items added', color: '#2323A3' }]}
          dateFormat="MMM yy"
          height={200}
        />
      </div>
    </div>
  );
}
