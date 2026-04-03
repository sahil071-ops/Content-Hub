-- ============================================================
-- Migration 014: Email verification columns for leads
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_valid        BOOLEAN,
  ADD COLUMN IF NOT EXISTS email_disposable   BOOLEAN,
  ADD COLUMN IF NOT EXISTS email_deliverable  BOOLEAN;

NOTIFY pgrst, 'reload schema';
