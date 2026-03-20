'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useRouter, usePathname } from 'next/navigation';

interface BarItem {
  name: string;
  value: number;
  filter?: string; // URL filter value to apply on click
}

interface RechartsBarProps {
  data: BarItem[];
  color?: string;
  filterKey?: string; // e.g. 'product' or 'topic'
  height?: number;
  horizontal?: boolean;
  label?: string;
}

export function RechartsBar({
  data,
  color = '#2323A3',
  filterKey,
  height = 280,
  horizontal = false,
  label,
}: RechartsBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(item: BarItem) {
    if (!filterKey || !item.filter) return;
    const params = new URLSearchParams();
    params.set(filterKey, item.filter);
    router.push(`/library?${params.toString()}`);
  }

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any) => [(v as number).toLocaleString(), label || 'Count']} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor={filterKey ? 'pointer' : 'default'} onClick={(d) => handleClick(d as unknown as BarItem)}>
            {data.map((_, i) => <Cell key={i} fill={color} fillOpacity={0.85 - i * 0.02} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [(v as number).toLocaleString(), label || 'Count']} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} cursor={filterKey ? 'pointer' : 'default'} onClick={(d) => handleClick(d as unknown as BarItem)} />
      </BarChart>
    </ResponsiveContainer>
  );
}
