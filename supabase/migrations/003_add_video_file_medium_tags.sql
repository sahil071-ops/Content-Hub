-- ============================================================
-- AXIS CONTENT HUB — Add video_file content type, medium tag type, and medium_tags column
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add video_file to the content type enum
alter type content_type_enum add value if not exists 'video_file';

-- 2. Add medium to the tag type enum
alter type tag_type_enum add value if not exists 'medium';

-- 3. Add medium_tags column to content_items
alter table content_items
  add column if not exists medium_tags text[] not null default '{}';
