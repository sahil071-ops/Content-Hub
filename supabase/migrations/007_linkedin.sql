-- ============================================================
-- Migration 007: LinkedIn Performance Tracker
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE linkedin_account_type_enum AS ENUM ('personal', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE linkedin_post_format_enum AS ENUM (
    'text', 'image', 'video', 'carousel', 'document', 'poll', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE linkedin_extraction_status_enum AS ENUM (
    'manual', 'ai_extracted', 'ai_partial', 'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE linkedin_insight_type_enum AS ENUM (
    'pattern', 'recommendation', 'anomaly', 'summary'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE linkedin_post_status_enum AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── linkedin_accounts ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  account_type linkedin_account_type_enum NOT NULL DEFAULT 'personal',
  profile_url  TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── linkedin_posts ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  post_url            TEXT,
  post_date           DATE NOT NULL,
  post_text           TEXT,
  post_format         linkedin_post_format_enum NOT NULL DEFAULT 'text',
  status              linkedin_post_status_enum NOT NULL DEFAULT 'published',
  topic_tags          TEXT[] NOT NULL DEFAULT '{}',
  product_tags        TEXT[] NOT NULL DEFAULT '{}',

  -- Metrics (all optional — may be null for partial entries)
  impressions         INTEGER,
  reactions           INTEGER,
  comments            INTEGER,
  shares              INTEGER,
  profile_visits      INTEGER,
  follows_gained      INTEGER,
  link_clicks         INTEGER,

  -- Computed metric (stored for fast querying/sorting)
  engagement_rate     FLOAT,

  -- Screenshot
  screenshot_url      TEXT,
  extraction_status   linkedin_extraction_status_enum NOT NULL DEFAULT 'manual',
  extraction_notes    TEXT,

  -- Link to content asset
  linked_content_id   UUID REFERENCES content_items(id) ON DELETE SET NULL,

  -- Tracking
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS linkedin_posts_account_idx    ON linkedin_posts (account_id);
CREATE INDEX IF NOT EXISTS linkedin_posts_post_date_idx  ON linkedin_posts (post_date DESC);
CREATE INDEX IF NOT EXISTS linkedin_posts_status_idx     ON linkedin_posts (status);
CREATE INDEX IF NOT EXISTS linkedin_posts_format_idx     ON linkedin_posts (post_format);
CREATE INDEX IF NOT EXISTS linkedin_posts_tags_idx       ON linkedin_posts USING GIN (topic_tags);
CREATE INDEX IF NOT EXISTS linkedin_posts_prod_tags_idx  ON linkedin_posts USING GIN (product_tags);
CREATE INDEX IF NOT EXISTS linkedin_posts_eng_rate_idx   ON linkedin_posts (engagement_rate DESC NULLS LAST);

-- ── linkedin_ai_insights ───────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_ai_insights (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start        DATE,
  period_end          DATE,
  account_id          UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  insight_type        linkedin_insight_type_enum NOT NULL DEFAULT 'pattern',
  content             TEXT NOT NULL,
  supporting_post_ids UUID[] NOT NULL DEFAULT '{}',
  thumbs_up           BOOLEAN,
  run_id              UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS linkedin_insights_account_idx ON linkedin_ai_insights (account_id);
CREATE INDEX IF NOT EXISTS linkedin_insights_run_idx     ON linkedin_ai_insights (run_id);
CREATE INDEX IF NOT EXISTS linkedin_insights_gen_at_idx  ON linkedin_ai_insights (generated_at DESC);

-- ── Trigger: compute engagement_rate on insert/update ──────

CREATE OR REPLACE FUNCTION compute_linkedin_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.impressions IS NOT NULL AND NEW.impressions > 0 THEN
    NEW.engagement_rate := ROUND(
      (COALESCE(NEW.reactions, 0) + COALESCE(NEW.comments, 0) + COALESCE(NEW.shares, 0))::FLOAT
      / NEW.impressions * 100,
      2
    );
  ELSE
    NEW.engagement_rate := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS linkedin_posts_engagement_rate ON linkedin_posts;
CREATE TRIGGER linkedin_posts_engagement_rate
  BEFORE INSERT OR UPDATE ON linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION compute_linkedin_engagement_rate();

-- ── RLS Policies ──────────────────────────────────────────

ALTER TABLE linkedin_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_ai_insights ENABLE ROW LEVEL SECURITY;

-- linkedin_accounts: admin+marketing can read; admin can write
DROP POLICY IF EXISTS linkedin_accounts_select ON linkedin_accounts;
CREATE POLICY linkedin_accounts_select ON linkedin_accounts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS linkedin_accounts_insert ON linkedin_accounts;
CREATE POLICY linkedin_accounts_insert ON linkedin_accounts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS linkedin_accounts_update ON linkedin_accounts;
CREATE POLICY linkedin_accounts_update ON linkedin_accounts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS linkedin_accounts_delete ON linkedin_accounts;
CREATE POLICY linkedin_accounts_delete ON linkedin_accounts FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- linkedin_posts: admin+marketing read+write; sales read only
DROP POLICY IF EXISTS linkedin_posts_select ON linkedin_posts;
CREATE POLICY linkedin_posts_select ON linkedin_posts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS linkedin_posts_insert ON linkedin_posts;
CREATE POLICY linkedin_posts_insert ON linkedin_posts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS linkedin_posts_update ON linkedin_posts;
CREATE POLICY linkedin_posts_update ON linkedin_posts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS linkedin_posts_delete ON linkedin_posts;
CREATE POLICY linkedin_posts_delete ON linkedin_posts FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

-- linkedin_ai_insights: admin+marketing read+write; sales read only
DROP POLICY IF EXISTS linkedin_insights_select ON linkedin_ai_insights;
CREATE POLICY linkedin_insights_select ON linkedin_ai_insights FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS linkedin_insights_insert ON linkedin_ai_insights;
CREATE POLICY linkedin_insights_insert ON linkedin_ai_insights FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS linkedin_insights_update ON linkedin_ai_insights;
CREATE POLICY linkedin_insights_update ON linkedin_ai_insights FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
