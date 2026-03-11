-- ============================================================
-- AXIS CONTENT HUB — Add new content types
-- Run in Supabase SQL Editor
-- ============================================================

alter type content_type_enum add value if not exists 'poster';
alter type content_type_enum add value if not exists 'catalogue';
alter type content_type_enum add value if not exists 'flier';
alter type content_type_enum add value if not exists 'graphic';
