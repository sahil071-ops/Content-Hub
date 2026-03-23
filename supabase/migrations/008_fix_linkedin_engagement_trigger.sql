-- ============================================================
-- Migration 008: Fix linkedin engagement rate trigger
-- ============================================================
-- PostgreSQL's ROUND(double precision, integer) does not exist.
-- Must cast expression to NUMERIC before calling ROUND with a scale arg.

CREATE OR REPLACE FUNCTION compute_linkedin_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.impressions IS NOT NULL AND NEW.impressions > 0 THEN
    NEW.engagement_rate := ROUND(
      (COALESCE(NEW.reactions, 0) + COALESCE(NEW.comments, 0) + COALESCE(NEW.shares, 0))::NUMERIC
      / NEW.impressions::NUMERIC * 100,
      2
    )::FLOAT;
  ELSE
    NEW.engagement_rate := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (function replacement is enough; trigger stays)
DROP TRIGGER IF EXISTS linkedin_posts_engagement_rate ON linkedin_posts;
CREATE TRIGGER linkedin_posts_engagement_rate
  BEFORE INSERT OR UPDATE ON linkedin_posts
  FOR EACH ROW EXECUTE FUNCTION compute_linkedin_engagement_rate();

NOTIFY pgrst, 'reload schema';
