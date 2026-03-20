'use client';

import { useState } from 'react';
import { RefreshCw, Globe, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { MisPeriodTypeEnum } from '@/types/database';

interface DashboardControlsProps {
  isAdmin: boolean;
  periodType: MisPeriodTypeEnum;
  onPeriodChange: (p: MisPeriodTypeEnum) => void;
  countryFilter: 'all' | 'india';
  onCountryFilterChange: (c: 'all' | 'india') => void;
}

export function DashboardControls({
  isAdmin,
  periodType,
  onPeriodChange,
  countryFilter,
  onCountryFilterChange,
}: DashboardControlsProps) {
  const [pulling, setPulling] = useState(false);

  async function handleManualPull() {
    setPulling(true);
    try {
      const res = await fetch('/api/analytics/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_type: periodType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Data pull complete — ${data.results} source${data.results !== 1 ? 's' : ''} updated`);
      // Refresh the page to show new data
      setTimeout(() => window.location.reload(), 800);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <Select value={periodType} onValueChange={(v) => onPeriodChange(v as MisPeriodTypeEnum)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="weekly">Last Week</SelectItem>
          <SelectItem value="monthly">Last Month</SelectItem>
          <SelectItem value="quarterly">Last Quarter</SelectItem>
          <SelectItem value="annual">Last Year</SelectItem>
        </SelectContent>
      </Select>

      {/* Country filter */}
      <div className="flex rounded-md border overflow-hidden">
        <button
          onClick={() => onCountryFilterChange('all')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
            countryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          }`}
        >
          <Globe className="h-3 w-3" />Overall
        </button>
        <button
          onClick={() => onCountryFilterChange('india')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors border-l ${
            countryFilter === 'india' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          }`}
        >
          <MapPin className="h-3 w-3" />India
        </button>
      </div>

      {/* Manual pull — admin only */}
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleManualPull}
          disabled={pulling}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${pulling ? 'animate-spin' : ''}`} />
          {pulling ? 'Pulling...' : 'Pull data now'}
        </Button>
      )}
    </div>
  );
}
