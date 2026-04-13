-- ============================================================
-- AXIS CONTENT HUB — Duplicate metric_snapshots Cleanup
-- ============================================================
--
-- PURPOSE:
--   Remove duplicate rows from metric_snapshots, keeping only the most
--   recently pulled snapshot for each (source, period_start, snapshot_type)
--   combination.
--
-- WHEN TO RUN:
--   Run this ONCE in the Supabase SQL editor if multiple manual pulls have
--   created duplicate snapshots for the same period. After running, the
--   upsert logic added in v0.7.0 prevents future duplicates automatically.
--
-- HOW TO RUN:
--   1. Go to Supabase dashboard → SQL editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Verify: SELECT count(*) FROM metric_snapshots; — should have reduced
--
-- SAFETY:
--   - Only deletes duplicate rows; the most recent pull for each period is kept.
--   - The WHERE clause uses a subquery to find the canonical IDs to keep.
--   - Test with the SELECT preview below before running the DELETE.
--
-- ============================================================

-- PREVIEW: See what would be deleted (run this first to verify)
SELECT
  id,
  source,
  snapshot_type,
  period_start,
  pulled_at,
  'WOULD DELETE' AS action
FROM metric_snapshots
WHERE id NOT IN (
  SELECT DISTINCT ON (source, period_start, snapshot_type) id
  FROM metric_snapshots
  ORDER BY source, period_start, snapshot_type, pulled_at DESC
)
ORDER BY source, period_start;

-- ============================================================

-- ACTUAL DELETE: Uncomment and run after verifying the preview above
/*
DELETE FROM metric_snapshots
WHERE id NOT IN (
  SELECT DISTINCT ON (source, period_start, snapshot_type) id
  FROM metric_snapshots
  ORDER BY source, period_start, snapshot_type, pulled_at DESC
);
*/

-- ============================================================
-- OPTIONAL: Same cleanup for youtube_snapshots if needed
-- (keeps one snapshot per day)
/*
DELETE FROM youtube_snapshots
WHERE id NOT IN (
  SELECT DISTINCT ON (DATE(pulled_at)) id
  FROM youtube_snapshots
  ORDER BY DATE(pulled_at), pulled_at DESC
);
*/
