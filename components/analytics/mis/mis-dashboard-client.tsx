'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { DashboardControls } from './dashboard-controls';
import { DashboardLayout } from './dashboard-layout';
import { YouTubeSection } from './youtube-section';
import { SearchConsoleSection } from './search-console-section';
import { GA4Section } from './ga4-section';
import { BrevoSection } from './brevo-section';
import { cn } from '@/lib/utils';
import type {
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

interface YoutubeSnapshotPoint {
  subscriber_count: number;
  pulled_at: string;
}

interface MisDashboardClientProps {
  snapshots: SnapshotMap;
  initialConfig: WidgetConfig[];
  isAdmin: boolean;
  hasGA4Main: boolean;
  hasGA4Es: boolean;
  hasGscMain: boolean;
  hasGscEs: boolean;
  hasYoutube: boolean;
  hasBrevo: boolean;
  lastPullTime?: string | null;
  youtubeSnapshots?: YoutubeSnapshotPoint[];
}

// Source accent colours for section borders and nav pills
const SOURCE_COLORS = {
  youtube:        { border: 'border-l-red-500',     pill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',     dot: 'bg-red-500' },
  gsc:            { border: 'border-l-emerald-500',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  ga4:            { border: 'border-l-blue-500',     pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  brevo:          { border: 'border-l-teal-500',     pill: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', dot: 'bg-teal-500' },
};

const EMPTY_PLACEHOLDER = (
  <div className="py-8 text-center text-sm text-muted-foreground">
    No data yet. Trigger a pull to load data for this source.
  </div>
);

function SectionCard({
  id,
  title,
  question,
  colorKey,
  children,
}: {
  id: string;
  title: string;
  question: string;
  colorKey: keyof typeof SOURCE_COLORS;
  children: React.ReactNode;
}) {
  const color = SOURCE_COLORS[colorKey];
  return (
    <div id={id} className={cn('rounded-lg border border-l-4 bg-card', color.border)}>
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-bold text-base">{title}</h2>
          <p className="text-sm text-muted-foreground">{question}</p>
        </div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

export function MisDashboardClient({
  snapshots,
  initialConfig,
  isAdmin,
  hasGA4Main,
  hasGA4Es,
  hasGscMain,
  hasGscEs,
  hasYoutube,
  hasBrevo,
  lastPullTime,
  youtubeSnapshots,
}: MisDashboardClientProps) {
  const [periodType, setPeriodType] = useState<MisPeriodTypeEnum>('monthly');
  const [countryFilter, setCountryFilter] = useState<'all' | 'india'>('all');
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden to avoid SSR flash
  useEffect(() => {
    setBannerDismissed(localStorage.getItem('mis_detail_banner_dismissed') === '1');
  }, []);
  function dismissBanner() {
    localStorage.setItem('mis_detail_banner_dismissed', '1');
    setBannerDismissed(true);
  }

  // Build the list of active sections for the mini nav
  const navSections: { id: string; label: string; colorKey: keyof typeof SOURCE_COLORS }[] = [
    ...(hasYoutube || snapshots.youtube ? [{ id: 'section-youtube', label: 'YouTube', colorKey: 'youtube' as const }] : []),
    ...(hasGscMain || snapshots.gsc_main ? [{ id: 'section-gsc-main', label: 'Search Console', colorKey: 'gsc' as const }] : []),
    ...(hasGscEs || snapshots.gsc_es ? [{ id: 'section-gsc-es', label: 'GSC — ES', colorKey: 'gsc' as const }] : []),
    ...(hasGA4Main || snapshots.ga4_main ? [{ id: 'section-ga4-main', label: 'GA4', colorKey: 'ga4' as const }] : []),
    ...(hasGA4Es || snapshots.ga4_es ? [{ id: 'section-ga4-es', label: 'GA4 — ES', colorKey: 'ga4' as const }] : []),
    ...(hasBrevo || snapshots.brevo ? [{ id: 'section-brevo', label: 'Brevo', colorKey: 'brevo' as const }] : []),
  ];

  const widgets = [
    ...(hasYoutube || snapshots.youtube ? [{
      id: 'youtube',
      label: 'YouTube Analytics',
      badge: 'YouTube',
      component: (
        <SectionCard id="section-youtube" title="YouTube Analytics" question="Is our channel growing?" colorKey="youtube">
          {snapshots.youtube
            ? <YouTubeSection
                data={snapshots.youtube}
                periodType={periodType}
                youtubeSnapshots={youtubeSnapshots}
              />
            : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
    }] : []),
    ...(hasGscMain || snapshots.gsc_main ? [{
      id: 'gsc_main',
      label: 'Search Console — Main Site',
      badge: 'GSC',
      component: (
        <SectionCard id="section-gsc-main" title="Search Console — Main Site" question="Are we ranking and are people clicking?" colorKey="gsc">
          {snapshots.gsc_main
            ? <SearchConsoleSection data={snapshots.gsc_main} countryFilter={countryFilter} />
            : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
    }] : []),
    ...(hasGscEs || snapshots.gsc_es ? [{
      id: 'gsc_es',
      label: 'Search Console — ES Site',
      badge: 'GSC',
      component: (
        <SectionCard id="section-gsc-es" title="Search Console — ES Site" question="Are we ranking and are people clicking?" colorKey="gsc">
          {snapshots.gsc_es
            ? <SearchConsoleSection data={snapshots.gsc_es} countryFilter={countryFilter} />
            : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
    }] : []),
    ...(hasGA4Main || snapshots.ga4_main ? [{
      id: 'ga4_main',
      label: 'GA4 — Main Site',
      badge: 'GA4',
      component: (
        <SectionCard id="section-ga4-main" title="GA4 — Main Site" question="Where is our website traffic coming from?" colorKey="ga4">
          {snapshots.ga4_main
            ? <GA4Section data={snapshots.ga4_main} countryFilter={countryFilter} />
            : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
    }] : []),
    ...(hasGA4Es || snapshots.ga4_es ? [{
      id: 'ga4_es',
      label: 'GA4 — ES Site',
      badge: 'GA4',
      component: (
        <SectionCard id="section-ga4-es" title="GA4 — ES Site" question="Where is our Spanish site traffic coming from?" colorKey="ga4">
          {snapshots.ga4_es
            ? <GA4Section data={snapshots.ga4_es} countryFilter={countryFilter} />
            : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
    }] : []),
    ...(hasBrevo || snapshots.brevo ? [{
      id: 'brevo',
      label: 'Brevo Email Marketing',
      badge: 'Brevo',
      component: (
        <SectionCard id="section-brevo" title="Brevo Email Marketing" question="How are our email campaigns performing?" colorKey="brevo">
          {snapshots.brevo ? <BrevoSection data={snapshots.brevo} /> : EMPTY_PLACEHOLDER}
        </SectionCard>
      ),
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
    <div className="space-y-0">
      {/* ── Sticky controls bar ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b pb-3 pt-2 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardControls
            isAdmin={isAdmin}
            periodType={periodType}
            onPeriodChange={setPeriodType}
            countryFilter={countryFilter}
            onCountryFilterChange={setCountryFilter}
          />
          {/* Last updated timestamp */}
          {lastPullTime && (
            <p className="text-xs text-muted-foreground shrink-0">
              Last updated: {new Date(lastPullTime).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* Mini section nav */}
        {navSections.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {navSections.map(s => {
              const color = SOURCE_COLORS[s.colorKey];
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    color.pill,
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', color.dot)} />
                  {s.label}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dismissible info banner ── */}
      {!bannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 mb-2">
          <span>
            This is the detailed analytics drill-down. For your weekly summary and AI insights, visit the{' '}
            <Link href="/dashboard" className="font-medium underline hover:no-underline">Dashboard</Link>.
          </span>
          <button onClick={dismissBanner} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Configurable widget layout (sections wrapped in SectionCard above) ── */}
      <div className="mt-6">
        <DashboardLayout
          widgets={widgets}
          initialConfig={initialConfig}
          dashboardName="mis"
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
