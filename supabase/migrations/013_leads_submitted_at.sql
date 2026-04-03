-- ============================================================
-- Migration 013: Add submitted_at and date_estimated to leads
-- ============================================================
-- submitted_at: the actual date the lead was submitted (from Zoho Created_Time)
-- date_estimated: true if the date was estimated (not from a real timestamp)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_estimated BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: use zoho_created_at if available, else zoho_modified_at, else pulled_at
UPDATE leads
SET
  submitted_at   = COALESCE(zoho_created_at, zoho_modified_at, pulled_at),
  date_estimated = (zoho_created_at IS NULL)
WHERE submitted_at IS NULL;

-- Sort default: index for descending submitted_at
CREATE INDEX IF NOT EXISTS leads_submitted_at_idx ON leads (submitted_at DESC);

NOTIFY pgrst, 'reload schema';
