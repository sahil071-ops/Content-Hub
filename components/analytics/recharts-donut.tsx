'use client';

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useRouter } from 'next/navigation';

interface DonutSlice {
  name: string;
  value: number;
  filter?: string;
  color?: string;
}

const COLORS = [
  '#2323A3', '#59A7F1', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
];

interface RechartsDonutProps {
  data: DonutSlice[];
  filterKey?: string;
  height?: number;
}

export function RechartsDonut({ data, filterKey, height = 280 }: RechartsDonutProps) {
  const router = useRouter();

  function handleClick(slice: DonutSlice) {
    if (!filterKey || !slice.filter) return;
    const params = new URLSearchParams();
    params.set(filterKey, slice.filter);
    router.push(`/library?${params.toString()}`);
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="50%"
          outerRadius="70%"
          dataKey="value"
          cursor={filterKey ? 'pointer' : 'default'}
          onClick={(d) => handleClick(d as unknown as DonutSlice)}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => [(v as number).toLocaleString(), 'Items']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
