'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  prev?: string | number;
  unit?: string;
  format?: 'number' | 'percent' | 'duration';
  className?: string;
}

function pctChange(current: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function fmt(value: string | number, format?: string, unit?: string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  const formatted =
    format === 'percent' ? `${n.toFixed(1)}%` :
    format === 'duration' ? `${(n / 60).toFixed(1)}h` :
    n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` :
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` :
    n.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

export function MetricCard({ label, value, prev, unit, format, className }: MetricCardProps) {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  const numPrev = prev !== undefined ? (typeof prev === 'string' ? parseFloat(prev) : prev) : undefined;
  const change = numPrev !== undefined ? pctChange(numVal, numPrev) : null;

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{fmt(value, format, unit)}</p>
      {change !== null && (
        <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', {
          'text-emerald-600 dark:text-emerald-400': change > 0,
          'text-red-600 dark:text-red-400': change < 0,
          'text-muted-foreground': change === 0,
        })}>
          {change > 0 ? <TrendingUp className="h-3 w-3" /> :
           change < 0 ? <TrendingDown className="h-3 w-3" /> :
           <Minus className="h-3 w-3" />}
          <span>{change > 0 ? '+' : ''}{change}% vs prev</span>
        </div>
      )}
    </div>
  );
}
