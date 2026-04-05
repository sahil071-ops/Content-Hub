import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MisDashboardClient } from '@/components/analytics/mis/mis-dashboard-client';
import type {
  UserRoleEnum,
  MisSnapshot,
  WidgetConfig,
  GA4SnapshotData,
  GscSnapshotData,
  YoutubeSnapshotData,
  BrevoSnapshotData,
  YoutubeSnapshotRow,
} from '@/types/database';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Marketing MIS Dashboard' };
export const dynamic = 'force-dynamic';

export default async function MisDashboardPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect('/login');

  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;

  if (!['admin', 'marketing'].includes(userRole)) {
    redirect('/library');
  }

  // Fetch the latest snapshot for each source/property combination
  const { data: snapshotRows } = await supabase
    .from('mis_snapshots')
    .select('*')
    .order('period_start', { ascending: false })
    .limit(20);

  const snapshots = (snapshotRows || []) as MisSnapshot[];

  // Get most recent snapshot per source+property
  function latestFor(source: string, property: string): MisSnapshot | undefined {
    return snapshots.find((s) => s.source === source && s.property === property);
  }

  const ga4Main = latestFor('ga4', 'main');
  const ga4Es = latestFor('ga4', 'es');
  const gscMain = latestFor('search_console', 'main');
  const gscEs = latestFor('search_console', 'es');
  const youtube = latestFor('youtube', 'default');
  const brevo = latestFor('brevo', 'default');

  // AI highlights are no longer shown on the MIS page — they live on /dashboard only.

  // Fetch user's dashboard config
  const { data: configRow } = await supabase
    .from('dashboard_configs')
    .select('config')
    .or(`user_id.eq.${authUser.id},is_default.eq.true`)
    .order('is_default', { ascending: false }) // prefer user config first
    .limit(1)
    .single();

  const initialConfig: WidgetConfig[] = (configRow as any)?.config?.widgets || [];

  const isAdmin = userRole === 'admin';

  // Fetch youtube_snapshots for subscriber growth calculation
  const { data: ytSnapshotRows } = await supabase
    .from('youtube_snapshots')
    .select('subscriber_count, total_view_count, pulled_at')
    .order('pulled_at', { ascending: false })
    .limit(60);

  const youtubeSnapshots = (ytSnapshotRows || []) as Pick<YoutubeSnapshotRow, 'subscriber_count' | 'pulled_at'>[];

  // Determine which env vars are configured (without exposing values)
  const hasGA4Main = Boolean(process.env.GA4_PROPERTY_ID_MAIN);
  const hasGA4Es = Boolean(process.env.GA4_PROPERTY_ID_ES);
  const hasGscMain = Boolean(process.env.GSC_SITE_URL_MAIN);
  const hasGscEs = Boolean(process.env.GSC_SITE_URL_ES);
  const hasYoutube = Boolean(process.env.YOUTUBE_CHANNEL_ID);
  const hasBrevo = Boolean(process.env.BREVO_API_KEY);

  // Most recent pull timestamp across all snapshots
  const lastPullTime = snapshotRows?.[0]?.created_at ?? null;

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Detailed MIS Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Full analytics drill-down — GA4, Search Console, YouTube, and Brevo
        </p>
      </div>

      <MisDashboardClient
        snapshots={{
          ga4_main: ga4Main?.data as GA4SnapshotData | undefined,
          ga4_es: ga4Es?.data as GA4SnapshotData | undefined,
          gsc_main: gscMain?.data as GscSnapshotData | undefined,
          gsc_es: gscEs?.data as GscSnapshotData | undefined,
          youtube: youtube?.data as YoutubeSnapshotData | undefined,
          brevo: brevo?.data as BrevoSnapshotData | undefined,
        }}
        initialConfig={initialConfig}
        isAdmin={isAdmin}
        hasGA4Main={hasGA4Main}
        hasGA4Es={hasGA4Es}
        hasGscMain={hasGscMain}
        hasGscEs={hasGscEs}
        hasYoutube={hasYoutube}
        hasBrevo={hasBrevo}
        lastPullTime={lastPullTime}
        youtubeSnapshots={youtubeSnapshots}
      />
    </div>
  );
}
