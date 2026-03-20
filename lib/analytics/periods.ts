import { format, subDays, subWeeks, subMonths, subQuarters, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Returns current and previous date ranges for a given period type.
 * Used for MIS data pulls.
 */
export function getPeriodDates(type: PeriodType, referenceDate: Date = new Date()): DateRange {
  switch (type) {
    case 'weekly': {
      const end = endOfWeek(subWeeks(referenceDate, 1), { weekStartsOn: 1 });
      const start = startOfWeek(end, { weekStartsOn: 1 });
      const prevEnd = endOfWeek(subWeeks(end, 1), { weekStartsOn: 1 });
      const prevStart = startOfWeek(prevEnd, { weekStartsOn: 1 });
      return { startDate: fmt(start), endDate: fmt(end), prevStartDate: fmt(prevStart), prevEndDate: fmt(prevEnd) };
    }
    case 'monthly': {
      const end = endOfMonth(subMonths(referenceDate, 1));
      const start = startOfMonth(end);
      const prevEnd = endOfMonth(subMonths(end, 1));
      const prevStart = startOfMonth(prevEnd);
      return { startDate: fmt(start), endDate: fmt(end), prevStartDate: fmt(prevStart), prevEndDate: fmt(prevEnd) };
    }
    case 'quarterly': {
      const end = endOfQuarter(subQuarters(referenceDate, 1));
      const start = startOfQuarter(end);
      const prevEnd = endOfQuarter(subQuarters(end, 1));
      const prevStart = startOfQuarter(prevEnd);
      return { startDate: fmt(start), endDate: fmt(end), prevStartDate: fmt(prevStart), prevEndDate: fmt(prevEnd) };
    }
    case 'annual': {
      const end = endOfYear(subYears(referenceDate, 1));
      const start = startOfYear(end);
      const prevEnd = endOfYear(subYears(end, 1));
      const prevStart = startOfYear(prevEnd);
      return { startDate: fmt(start), endDate: fmt(end), prevStartDate: fmt(prevStart), prevEndDate: fmt(prevEnd) };
    }
  }
}

/**
 * Returns relative date ranges for the dashboard UI.
 */
export function getRelativeDateRange(preset: string): { start: string; end: string } {
  const today = new Date();
  const end = fmt(today);
  switch (preset) {
    case '7d':   return { start: fmt(subDays(today, 7)), end };
    case '30d':  return { start: fmt(subDays(today, 30)), end };
    case '90d':  return { start: fmt(subDays(today, 90)), end };
    case '1y':   return { start: fmt(subDays(today, 365)), end };
    default:     return { start: fmt(subDays(today, 30)), end };
  }
}
