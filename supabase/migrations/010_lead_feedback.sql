-- ============================================================
-- Migration 010: Lead feedback & AI training table
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_feedback (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- 'spam'    → feedback on whether this is spam or not
  -- 'quality' → feedback on whether this is high-value or not
  feedback_type    TEXT NOT NULL CHECK (feedback_type IN ('spam', 'quality')),

  -- What the AI/system originally decided (true = spam/high-value)
  original_decision BOOLEAN NOT NULL,
  -- What the reviewer says it should be
  user_decision     BOOLEAN NOT NULL,
  -- Freetext explanation (used as training context for future classifications)
  user_note         TEXT,

  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_feedback_lead_idx    ON lead_feedback (lead_id);
CREATE INDEX IF NOT EXISTS lead_feedback_type_idx    ON lead_feedback (feedback_type);
CREATE INDEX IF NOT EXISTS lead_feedback_created_idx ON lead_feedback (created_at DESC);

-- RLS: admin+marketing can read/write; sales read only
ALTER TABLE lead_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_select ON lead_feedback;
CREATE POLICY feedback_select ON lead_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing', 'sales')));

DROP POLICY IF EXISTS feedback_insert ON lead_feedback;
CREATE POLICY feedback_insert ON lead_feedback FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

DROP POLICY IF EXISTS feedback_update ON lead_feedback;
CREATE POLICY feedback_update ON lead_feedback FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));

NOTIFY pgrst, 'reload schema';
