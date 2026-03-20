'use client';

import { useState } from 'react';
import { DashboardControls } from './dashboard-controls';
import { DashboardLayout } from './dashboard-layout';
import { AiHighlightsPanel } from '@/components/analytics/ai-highlights-panel';
import { YouTubeSection } from './youtube-section';
import { SearchConsoleSection } from './search-console-section';
import { GA4Section } from './ga4-section';
import { BrevoSection } from './brevo-section';
import type {
  MisHighlight,
  MisPeriodTypeEnum,
  WidgetConfig,
  GA4SnapshotData,
  GscSnapshotData,
  YoutubeSnapshotData,
  BrevoSnapshotData,
} from '@/types/database';

interface SnapshotMap {
  ga4_main?: GA4SnapshotData;
  ga4_es?: GA4SnapshotData;
  gsc_main?: GscSnapshotData;
  gsc_es?: GscSnapshotData;
  youtube?: YoutubeSnapshotData;
  brevo?: BrevoSnapshotData;
}

interface MisDashboardClientProps {
  snapshots: SnapshotMap;
  latestHighlight: MisHighlight | null;
  initialConfig: WidgetConfig[];
  isAdmin: boolean;
  hasGA4Main: boolean;
  hasGA4Es: boolean;
  hasGscMain: boolean;
  hasGscEs: boolean;
  hasYoutube: boolean;
  hasBrevo: boolean;
}

export function MisDashboardClient({
  snapshots,
  latestHighlight,
  initialConfig,
  isAdmin,
  hasGA4Main,
  hasGA4Es,
  hasGscMain,
  hasGscEs,
  hasYoutube,
  hasBrevo,
}: MisDashboardClientProps) {
  const [periodType, setPeriodType] = useState<MisPeriodTypeEnum>('monthly');
  const [countryFilter, setCountryFilter] = useState<'all' | 'india'>('all');

  const EMPTY_PLACEHOLDER = (
    <div className="py-8 text-center text-sm text-muted-foreground">
      No data yet. Trigger a pull to load data for this source.
    </div>
  );

  const widgets = [
    ...(hasYoutube || snapshots.youtube ? [{
      id: 'youtube',
      label: 'YouTube Analytics',
      badge: 'YouTube',
      component: snapshots.youtube
        ? <YouTubeSection data={snapshots.youtube} />
        : EMPTY_PLACEHOLDER,
    }] : []),
    ...(hasGscMain || snapshots.gsc_main ? [{
      id: 'gsc_main',
      label: 'Search Console — Main Site',
      badge: 'GSC',
      component: snapshots.gsc_main
        ? <SearchConsoleSection data={snapshots.gsc_main} countryFilter={countryFilter} />
        : EMPTY_PLACEHOLDER,
    }] : []),
    ...(hasGscEs || snapshots.gsc_es ? [{
      id: 'gsc_es',
      label: 'Search Console — ES Site',
      badge: 'GSC',
      component: snapshots.gsc_es
        ? <SearchConsoleSection data={snapshots.gsc_es} countryFilter={countryFilter} />
        : EMPTY_PLACEHOLDER,
    }] : []),
    ...(hasGA4Main || snapshots.ga4_main ? [{
      id: 'ga4_main',
      label: 'GA4 — Main Site',
      badge: 'GA4',
      component: snapshots.ga4_main
        ? <GA4Section data={snapshots.ga4_main} countryFilter={countryFilter} />
        : EMPTY_PLACEHOLDER,
    }] : []),
    ...(hasGA4Es || snapshots.ga4_es ? [{
      id: 'ga4_es',
      label: 'GA4 — ES Site',
      badge: 'GA4',
      component: snapshots.ga4_es
        ? <GA4Section data={snapshots.ga4_es} countryFilter={countryFilter} />
        : EMPTY_PLACEHOLDER,
    }] : []),
    ...(hasBrevo || snapshots.brevo ? [{
      id: 'brevo',
      label: 'Brevo Email Marketing',
      badge: 'Brevo',
      component: snapshots.brevo
        ? <BrevoSection data={snapshots.brevo} />
        : EMPTY_PLACEHOLDER,
    }] : []),
  ];

  if (widgets.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="font-medium mb-2">No data sources configured</p>
        <p className="text-sm text-muted-foreground">
          Add environment variables for GA4, Search Console, YouTube, and/or Brevo to start pulling data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <DashboardControls
        isAdmin={isAdmin}
        periodType={periodType}
        onPeriodChange={setPeriodType}
        countryFilter={countryFilter}
        onCountryFilterChange={setCountryFilter}
      />

      {/* AI Highlights — always at top */}
      <AiHighlightsPanel highlight={latestHighlight} />

      {/* Configurable widget layout */}
      <DashboardLayout
        widgets={widgets}
        initialConfig={initialConfig}
        dashboardName="mis"
        isAdmin={isAdmin}
      />
    </div>
  );
}
