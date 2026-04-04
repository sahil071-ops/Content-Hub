-- Migration 015: metric_snapshots and youtube_snapshots tables
-- These tables support proper period-over-period comparison in the dashboard.
-- metric_snapshots stores a normalised subset of metrics per source per pull.
-- youtube_snapshots records subscriber count at each pull for growth tracking.

create table if not exists metric_snapshots (
  id           uuid primary key default gen_random_uuid(),
  snapshot_type text not null,     -- 'weekly' | 'monthly' | 'quarterly' | 'annual'
  period_start  date not null,
  period_end    date not null,
  source        text not null,     -- 'ga4_main' | 'ga4_es' | 'gsc_main' | 'gsc_es' | 'youtube' | 'brevo' | 'leads'
  metrics       jsonb not null,
  pulled_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists metric_snapshots_lookup
  on metric_snapshots (snapshot_type, source, period_start);

create table if not exists youtube_snapshots (
  id               uuid primary key default gen_random_uuid(),
  subscriber_count integer not null,
  total_view_count bigint,
  pulled_at        timestamptz not null default now()
);

-- RLS: these tables are server-only (service role). No public access needed.
alter table metric_snapshots enable row level security;
alter table youtube_snapshots enable row level security;

-- Allow service role full access (for server-side inserts via service client)
create policy "service role full access to metric_snapshots"
  on metric_snapshots for all
  using (true)
  with check (true);

create policy "service role full access to youtube_snapshots"
  on youtube_snapshots for all
  using (true)
  with check (true);
