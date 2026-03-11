-- ============================================================
-- AXIS CONTENT HUB — Initial Database Migration
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── Enable required extensions ────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for full-text search

-- ── Enums ─────────────────────────────────────────────────────

create type content_type_enum as enum (
  'video', 'pdf', 'image', 'presentation', 'emailer',
  'blog', 'whitepaper', 'ebook', 'other'
);

create type audience_tag_enum as enum (
  'internal', 'sales', 'distributor', 'end-client', 'public'
);

create type content_status_enum as enum (
  'draft', 'published', 'archived'
);

create type user_role_enum as enum (
  'admin', 'marketing', 'sales', 'distributor', 'viewer'
);

create type tag_type_enum as enum (
  'product', 'topic', 'audience', 'content_type'
);

create type backup_status_enum as enum (
  'success', 'failed', 'pending'
);

-- ── users table (extends auth.users) ─────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role_enum not null default 'viewer',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'App user profiles linked to Supabase auth.users';

-- ── tags_master ───────────────────────────────────────────────
create table public.tags_master (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  tag_type   tag_type_enum not null,
  color      text not null default '#3D3D3D',
  created_at timestamptz not null default now(),
  constraint tags_master_name_type_unique unique (name, tag_type)
);

comment on table public.tags_master is 'Master list of all tags (products, topics, etc.)';

-- ── content_items ─────────────────────────────────────────────
create table public.content_items (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  description      text,
  content_type     content_type_enum not null,
  file_url         text,
  backup_url       text,
  external_link    text,
  thumbnail_url    text,
  product_tags     text[] not null default '{}',
  topic_tags       text[] not null default '{}',
  audience_tags    audience_tag_enum[] not null default '{}',
  status           content_status_enum not null default 'draft',
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz,
  file_size_bytes  bigint,
  file_type        text,
  engagement_data  jsonb not null default '{}',
  meta             jsonb not null default '{}'
);

comment on table public.content_items is 'Core content repository — all uploaded files, links, and blog posts';
comment on column public.content_items.file_url is 'Cloudflare R2 URL for uploaded files';
comment on column public.content_items.backup_url is 'Backblaze B2 backup URL';
comment on column public.content_items.external_link is 'YouTube URL or external blog URL';
comment on column public.content_items.meta is 'Flexible JSONB for archived blog content, future metadata, etc.';
comment on column public.content_items.engagement_data is 'Flexible JSONB for Phase 3 analytics';

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_items_updated_at
  before update on public.content_items
  for each row execute function update_updated_at();

-- Full-text search index
create index content_items_search_idx on public.content_items
  using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Status + type indexes for filtering
create index content_items_status_idx on public.content_items(status);
create index content_items_type_idx on public.content_items(content_type);
create index content_items_created_at_idx on public.content_items(created_at desc);
create index content_items_product_tags_idx on public.content_items using gin(product_tags);
create index content_items_topic_tags_idx on public.content_items using gin(topic_tags);
create index content_items_audience_tags_idx on public.content_items using gin(audience_tags);

-- ── content_views (analytics foundation for Phase 3) ─────────
create table public.content_views (
  id          uuid primary key default uuid_generate_v4(),
  content_id  uuid not null references public.content_items(id) on delete cascade,
  viewer_role user_role_enum,
  viewed_at   timestamptz not null default now(),
  session_id  text
);

comment on table public.content_views is 'Analytics foundation — view events per content item. Populated in Phase 3.';
create index content_views_content_id_idx on public.content_views(content_id);
create index content_views_viewed_at_idx on public.content_views(viewed_at desc);

-- ── backup_logs ───────────────────────────────────────────────
create table public.backup_logs (
  id            uuid primary key default uuid_generate_v4(),
  content_id    uuid references public.content_items(id) on delete cascade,
  r2_url        text,
  b2_url        text,
  status        backup_status_enum not null default 'pending',
  attempted_at  timestamptz not null default now(),
  error_message text
);

comment on table public.backup_logs is 'Log of every R2→B2 backup attempt';
create index backup_logs_content_id_idx on public.backup_logs(content_id);
create index backup_logs_status_idx on public.backup_logs(status);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

alter table public.users enable row level security;
alter table public.tags_master enable row level security;
alter table public.content_items enable row level security;
alter table public.content_views enable row level security;
alter table public.backup_logs enable row level security;

-- ── Helper function: get current user role ────────────────────
create or replace function get_user_role()
returns user_role_enum language sql security definer stable as $$
  select role from public.users where id = auth.uid();
$$;

-- ── users RLS ─────────────────────────────────────────────────

-- Users can read their own profile; admins can read all
create policy "users_select" on public.users for select
  using (
    id = auth.uid()
    or get_user_role() = 'admin'
  );

-- Users can update their own profile; admins can update all
create policy "users_update" on public.users for update
  using (
    id = auth.uid()
    or get_user_role() = 'admin'
  );

-- Only service role can insert (handled via trigger on auth.users)
create policy "users_insert" on public.users for insert
  with check (get_user_role() = 'admin' or id = auth.uid());

-- Only admins can delete users
create policy "users_delete" on public.users for delete
  using (get_user_role() = 'admin');

-- ── Auto-create user profile on sign up ───────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'role')::user_role_enum, 'viewer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── tags_master RLS ───────────────────────────────────────────

-- All authenticated users can read tags
create policy "tags_select" on public.tags_master for select
  using (auth.role() = 'authenticated');

-- Admin and marketing can create/update tags
create policy "tags_insert" on public.tags_master for insert
  with check (get_user_role() in ('admin', 'marketing'));

create policy "tags_update" on public.tags_master for update
  using (get_user_role() in ('admin', 'marketing'));

-- Only admins can delete tags
create policy "tags_delete" on public.tags_master for delete
  using (get_user_role() = 'admin');

-- ── content_items RLS ─────────────────────────────────────────

-- SELECT: role-based visibility
create policy "content_select" on public.content_items for select
  using (
    -- Admins and marketing see everything
    get_user_role() in ('admin', 'marketing')
    or
    -- Sales see published content tagged for sales or public
    (
      get_user_role() = 'sales'
      and status = 'published'
      and (
        'sales'::audience_tag_enum = any(audience_tags)
        or 'public'::audience_tag_enum = any(audience_tags)
      )
    )
    or
    -- Distributors see published content tagged for distributors or public
    (
      get_user_role() = 'distributor'
      and status = 'published'
      and (
        'distributor'::audience_tag_enum = any(audience_tags)
        or 'public'::audience_tag_enum = any(audience_tags)
      )
    )
    or
    -- Viewers see published public content only
    (
      get_user_role() = 'viewer'
      and status = 'published'
      and 'public'::audience_tag_enum = any(audience_tags)
    )
  );

-- INSERT: admins and marketing only
create policy "content_insert" on public.content_items for insert
  with check (
    get_user_role() in ('admin', 'marketing')
    and created_by = auth.uid()
  );

-- UPDATE: admins can update anything; marketing can update their own content
create policy "content_update" on public.content_items for update
  using (
    get_user_role() = 'admin'
    or (get_user_role() = 'marketing' and created_by = auth.uid())
  );

-- DELETE: admins only
create policy "content_delete" on public.content_items for delete
  using (get_user_role() = 'admin');

-- ── content_views RLS ─────────────────────────────────────────

-- Admins can read all views
create policy "views_select" on public.content_views for select
  using (get_user_role() = 'admin');

-- Any authenticated user can record a view
create policy "views_insert" on public.content_views for insert
  with check (auth.role() = 'authenticated');

-- ── backup_logs RLS ───────────────────────────────────────────

-- Only admins can read backup logs
create policy "backup_logs_select" on public.backup_logs for select
  using (get_user_role() = 'admin');

-- Only service role (API) can insert/update backup logs
-- We use service_role key in API routes, which bypasses RLS
-- This policy exists as a fallback:
create policy "backup_logs_insert" on public.backup_logs for insert
  with check (get_user_role() = 'admin');

create policy "backup_logs_update" on public.backup_logs for update
  using (get_user_role() = 'admin');

-- ============================================================
-- SEED: Default admin user setup note
-- ============================================================
-- After running this migration, create your first user via
-- Supabase Auth (email magic link), then run:
--
--   update public.users
--   set role = 'admin'
--   where id = 'your-user-uuid-here';
--
-- See SETUP_GUIDE.md for full instructions.
-- ============================================================
