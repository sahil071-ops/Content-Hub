import { cn } from '@/lib/utils';

interface EngagementBadgeProps {
  rate: number | null;
  accountAvg?: number;
  className?: string;
}

export function EngagementBadge({ rate, accountAvg, className }: EngagementBadgeProps) {
  if (rate === null || rate === undefined) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  const label = `${rate.toFixed(2)}%`;

  if (!accountAvg) {
    return <span className={cn('text-sm font-semibold', className)}>{label}</span>;
  }

  const diff = rate - accountAvg;
  const isGood = diff >= 0;
  const isWarn = diff >= -accountAvg * 0.2; // within 20% below avg

  return (
    <span className={cn(
      'text-sm font-semibold px-1.5 py-0.5 rounded',
      isGood
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : isWarn
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      className
    )}>
      {label}
    </span>
  );
}
