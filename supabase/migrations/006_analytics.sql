-- ============================================================
-- Migration 006: Analytics Phase 2
-- Content Analytics Hub + Marketing MIS Dashboard
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE mis_source_enum AS ENUM ('ga4', 'search_console', 'youtube', 'brevo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mis_period_type_enum AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mis_pull_status_enum AS ENUM ('success', 'failed', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── mis_snapshots ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mis_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source        mis_source_enum NOT NULL,
  property      TEXT NOT NULL DEFAULT 'default',
  period_type   mis_period_type_enum NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  pulled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mis_snapshots_source_idx       ON mis_snapshots (source);
CREATE INDEX IF NOT EXISTS mis_snapshots_period_type_idx  ON mis_snapshots (period_type);
CREATE INDEX IF NOT EXISTS mis_snapshots_period_start_idx ON mis_snapshots (period_start DESC);
CREATE INDEX IF NOT EXISTS mis_snapshots_source_period_idx ON mis_snapshots (source, period_type, period_start DESC);

-- ── mis_pull_logs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mis_pull_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source         mis_source_enum NOT NULL,
  period_type    mis_period_type_enum NOT NULL,
  status         mis_pull_status_enum NOT NULL DEFAULT 'failed',
  pulled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS mis_pull_logs_source_idx    ON mis_pull_logs (source);
CREATE INDEX IF NOT EXISTS mis_pull_logs_pulled_at_idx ON mis_pull_logs (pulled_at DESC);

-- ── mis_highlights ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mis_highlights (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  period_type  mis_period_type_enum NOT NULL,
  highlights   JSONB NOT NULL DEFAULT '[]',
  feedback     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mis_highlights_period_idx ON mis_highlights (period_start DESC);

-- ── content_targets ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_targets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_name           TEXT NOT NULL,
  tag_type           TEXT NOT NULL DEFAULT 'product',
  target_percentage  NUMERIC(5,2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  set_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tag_name, tag_type)
);

-- ── dashboard_configs ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_configs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  dashboard_name TEXT NOT NULL DEFAULT 'mis',
  config         JSONB NOT NULL DEFAULT '{"widgets":[]}',
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dashboard_name)
);

CREATE INDEX IF NOT EXISTS dashboard_configs_user_idx      ON dashboard_configs (user_id);
CREATE INDEX IF NOT EXISTS dashboard_configs_default_idx   ON dashboard_configs (is_default) WHERE is_default = TRUE;

-- Ensure the updated_at trigger function exists (may not exist in all environments)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_content_targets_updated_at ON content_targets;
CREATE TRIGGER set_content_targets_updated_at
  BEFORE UPDATE ON content_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_dashboard_configs_updated_at ON dashboard_configs;
CREATE TRIGGER set_dashboard_configs_updated_at
  BEFORE UPDATE ON dashboard_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS Policies ──────────────────────────────────────────

ALTER TABLE mis_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mis_pull_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mis_highlights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_configs   ENABLE ROW LEVEL SECURITY;

-- mis_snapshots: admin + marketing can read; admin can write
DROP POLICY IF EXISTS mis_snapshots_select ON mis_snapshots;
CREATE POLICY mis_snapshots_select ON mis_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'marketing')
    )
  );

DROP POLICY IF EXISTS mis_snapshots_insert ON mis_snapshots;
CREATE POLICY mis_snapshots_insert ON mis_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- mis_pull_logs: admin + marketing can read; admin can write
DROP POLICY IF EXISTS mis_pull_logs_select ON mis_pull_logs;
CREATE POLICY mis_pull_logs_select ON mis_pull_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing'))
  );

DROP POLICY IF EXISTS mis_pull_logs_insert ON mis_pull_logs;
CREATE POLICY mis_pull_logs_insert ON mis_pull_logs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- mis_highlights: admin + marketing can read; admin can write; users can update feedback
DROP POLICY IF EXISTS mis_highlights_select ON mis_highlights;
CREATE POLICY mis_highlights_select ON mis_highlights FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing'))
  );

DROP POLICY IF EXISTS mis_highlights_insert ON mis_highlights;
CREATE POLICY mis_highlights_insert ON mis_highlights FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS mis_highlights_update ON mis_highlights;
CREATE POLICY mis_highlights_update ON mis_highlights FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing'))
  );

-- content_targets: admin + marketing + sales can read; admin can write
DROP POLICY IF EXISTS content_targets_select ON content_targets;
CREATE POLICY content_targets_select ON content_targets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales'))
  );

DROP POLICY IF EXISTS content_targets_insert ON content_targets;
CREATE POLICY content_targets_insert ON content_targets FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS content_targets_update ON content_targets;
CREATE POLICY content_targets_update ON content_targets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS content_targets_delete ON content_targets;
CREATE POLICY content_targets_delete ON content_targets FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- dashboard_configs: users see their own + default; admin sees all
DROP POLICY IF EXISTS dashboard_configs_select ON dashboard_configs;
CREATE POLICY dashboard_configs_select ON dashboard_configs FOR SELECT
  USING (user_id = auth.uid() OR is_default = TRUE OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS dashboard_configs_insert ON dashboard_configs;
CREATE POLICY dashboard_configs_insert ON dashboard_configs FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    (is_default = TRUE AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  );

DROP POLICY IF EXISTS dashboard_configs_update ON dashboard_configs;
CREATE POLICY dashboard_configs_update ON dashboard_configs FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (is_default = TRUE AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  );

DROP POLICY IF EXISTS dashboard_configs_delete ON dashboard_configs;
CREATE POLICY dashboard_configs_delete ON dashboard_configs FOR DELETE
  USING (user_id = auth.uid());

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
