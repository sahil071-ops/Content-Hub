'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface TimelinePoint {
  date: string;  // YYYY-MM-DD or YYYYMMDD
  [key: string]: number | string;
}

interface SeriesConfig {
  key: string;
  label: string;
  color?: string;
}

interface RechartsLineProps {
  data: TimelinePoint[];
  series: SeriesConfig[];
  height?: number;
  dateFormat?: string;
}

const TOOLTIP_CONTENT_STYLE = { backgroundColor: '#1a1a2e', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: '13px' };
const TOOLTIP_LABEL_STYLE = { color: '#d1d5db', marginBottom: '4px' };
const TOOLTIP_ITEM_STYLE = { color: '#f9fafb' };

const COLORS = ['#2323A3', '#59A7F1', '#FF6B6B', '#4ECDC4'];

function normalizeDate(d: string): string {
  // Handle YYYYMMDD format from GA4/YouTube
  if (d.length === 8 && !d.includes('-')) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return d;
}

export function RechartsLine({ data, series, height = 240, dateFormat = 'MMM d' }: RechartsLineProps) {
  const formattedData = data.map((d) => ({
    ...d,
    _label: (() => {
      try { return format(parseISO(normalizeDate(d.date)), dateFormat); }
      catch { return d.date; }
    })(),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formattedData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="_label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          labelFormatter={(label) => `Date: ${label}`}
          formatter={(v: any, name: any) => [(v as number).toLocaleString(), String(name)]}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
        />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color || COLORS[i % COLORS.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
