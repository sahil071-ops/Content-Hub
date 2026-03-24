-- ============================================================
-- Migration 009: Zoho CRM — Lead Tracking & Enrichment
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE lead_enrichment_status_enum AS ENUM ('none', 'pending', 'done', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── zoho_connections ───────────────────────────────────────────
-- Stores the OAuth tokens for the Zoho CRM account.
-- Only one active connection is expected (org-level).

CREATE TABLE IF NOT EXISTS zoho_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_center      TEXT NOT NULL DEFAULT 'com',   -- com | eu | in | au | jp
  access_token     TEXT,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  zoho_org_id      TEXT,
  zoho_user_email  TEXT,
  connected_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_pull_at     TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── leads ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zoho_id             TEXT NOT NULL UNIQUE,

  -- Core fields (mirrored from Zoho)
  first_name          TEXT,
  last_name           TEXT,
  email               TEXT,
  phone               TEXT,
  mobile              TEXT,
  company             TEXT,
  title               TEXT,
  website             TEXT,
  lead_source         TEXT,
  industry            TEXT,
  lead_status         TEXT,
  rating              TEXT,
  description         TEXT,
  country             TEXT,

  -- Spam detection
  is_spam             BOOLEAN NOT NULL DEFAULT FALSE,
  spam_score          FLOAT,              -- 0–100 (100 = definite spam)
  spam_reasons        TEXT[] NOT NULL DEFAULT '{}',
  spam_reviewed       BOOLEAN NOT NULL DEFAULT FALSE,  -- admin manually reviewed

  -- Quality / value
  quality_score       FLOAT,             -- 0–100
  is_high_value       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Enrichment
  enrichment_status   lead_enrichment_status_enum NOT NULL DEFAULT 'none',
  enrichment_done_at  TIMESTAMPTZ,

  -- Raw Zoho record
  raw_data            JSONB,

  -- Timestamps from Zoho
  zoho_created_at     TIMESTAMPTZ,
  zoho_modified_at    TIMESTAMPTZ,

  -- Local tracking
  pulled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_email_idx         ON leads (email);
CREATE INDEX IF NOT EXISTS leads_company_idx       ON leads (company);
CREATE INDEX IF NOT EXISTS leads_is_spam_idx       ON leads (is_spam);
CREATE INDEX IF NOT EXISTS leads_is_high_value_idx ON leads (is_high_value);
CREATE INDEX IF NOT EXISTS leads_enrichment_idx    ON leads (enrichment_status);
CREATE INDEX IF NOT EXISTS leads_pulled_at_idx     ON leads (pulled_at DESC);

-- ── lead_enrichments ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_enrichments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  company_summary       TEXT,
  likely_use_case       TEXT,
  recommended_products  TEXT[],
  talking_points        TEXT[],
  follow_up_suggestion  TEXT,
  deal_potential        TEXT,   -- low | medium | high
  notes                 TEXT,

  raw_response          JSONB,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_enrichments_lead_idx ON lead_enrichments (lead_id);

-- ── Trigger: auto-update updated_at ───────────────────────────

CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_leads_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE zoho_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_enrichments  ENABLE ROW LEVEL SECURITY;

-- zoho_connections: admin only
DROP POLICY IF EXISTS zoho_conn_select ON zoho_connections;
CREATE POLICY zoho_conn_select ON zoho_connections FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS zoho_conn_insert ON zoho_connections;
CREATE POLICY zoho_conn_insert ON zoho_connections FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS zoho_conn_update ON zoho_connections;
CREATE POLICY zoho_conn_update ON zoho_connections FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS zoho_conn_delete ON zoho_connections;
CREATE POLICY zoho_conn_delete ON zoho_connections FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- leads: admin+marketing read+write; sales read only
DROP POLICY IF EXISTS leads_select ON leads;
CREATE POLICY leads_select ON leads FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS leads_insert ON leads;
CREATE POLICY leads_insert ON leads FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS leads_update ON leads;
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS leads_delete ON leads;
CREATE POLICY leads_delete ON leads FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- lead_enrichments: same as leads
DROP POLICY IF EXISTS enrichments_select ON lead_enrichments;
CREATE POLICY enrichments_select ON lead_enrichments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS enrichments_insert ON lead_enrichments;
CREATE POLICY enrichments_insert ON lead_enrichments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS enrichments_update ON lead_enrichments;
CREATE POLICY enrichments_update ON lead_enrichments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

NOTIFY pgrst, 'reload schema';
