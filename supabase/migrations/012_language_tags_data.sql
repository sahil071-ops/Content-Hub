-- ============================================================
-- Migration 012: Language Tag Family (Step 2 of 2)
-- ============================================================
-- Run this AFTER migration 011 has been committed.
-- Adds language_tags column and migrates existing data.

-- ── Add column ──────────────────────────────────────────────

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS language_tags TEXT[] NOT NULL DEFAULT '{}';

-- ── Reclassify language tags in tags_master ─────────────────
-- Any tag currently under tag_type='topic' whose name matches
-- a known language is reassigned to tag_type='language'.

UPDATE tags_master
SET tag_type = 'language'
WHERE tag_type = 'topic'
  AND LOWER(name) IN (
    -- Indian languages (official + major regional)
    'english','hindi','gujarati','marathi','tamil','telugu','bengali',
    'kannada','malayalam','punjabi','urdu','odia','oriya','assamese',
    'sanskrit','sindhi','konkani','maithili','dogri','kashmiri','nepali',
    'bodo','santhali','manipuri','meitei',
    -- International
    'french','german','spanish','arabic','chinese','japanese','korean',
    'portuguese','italian','dutch','russian','turkish','persian','swahili'
  );

-- ── Migrate content_items ───────────────────────────────────
-- For each item, move any topic_tags that are now language tags
-- into language_tags, and remove them from topic_tags.

UPDATE content_items ci
SET
  language_tags = (
    SELECT COALESCE(ARRAY_AGG(t ORDER BY t), '{}')
    FROM UNNEST(ci.topic_tags) AS t
    WHERE LOWER(t) IN (SELECT LOWER(name) FROM tags_master WHERE tag_type = 'language')
  ),
  topic_tags = (
    SELECT COALESCE(ARRAY_AGG(t ORDER BY t), '{}')
    FROM UNNEST(ci.topic_tags) AS t
    WHERE LOWER(t) NOT IN (SELECT LOWER(name) FROM tags_master WHERE tag_type = 'language')
  )
WHERE EXISTS (
  SELECT 1 FROM UNNEST(ci.topic_tags) AS t
  WHERE LOWER(t) IN (SELECT LOWER(name) FROM tags_master WHERE tag_type = 'language')
);

NOTIFY pgrst, 'reload schema';
