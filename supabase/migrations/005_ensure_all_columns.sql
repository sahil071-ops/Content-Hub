-- Migration 005: Ensure all columns exist (safe to run even if 003/004 already applied)
-- Run this in Supabase SQL Editor if you are getting upload errors.

-- 1. Add 'medium' to tag_type_enum (migration 003 prerequisite)
ALTER TYPE tag_type_enum ADD VALUE IF NOT EXISTS 'medium';

-- 2. Add medium_tags column to content_items (migration 003)
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS medium_tags text[] NOT NULL DEFAULT '{}';

-- 3. Convert content_type from enum to text (migration 004)
--    Only runs if the column is still an enum type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_items'
      AND column_name = 'content_type'
      AND udt_name = 'content_type_enum'
  ) THEN
    ALTER TABLE public.content_items
      ALTER COLUMN content_type TYPE text USING content_type::text;
  END IF;
END $$;

-- 4. Create content_types registry table (migration 004)
CREATE TABLE IF NOT EXISTS public.content_types (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key          text UNIQUE NOT NULL,
  label        text NOT NULL,
  color_classes text NOT NULL DEFAULT 'bg-gray-100 text-gray-700 border-gray-200',
  sort_order   smallint NOT NULL DEFAULT 99,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_types' AND policyname = 'content_types_read') THEN
    CREATE POLICY "content_types_read" ON public.content_types
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_types' AND policyname = 'content_types_write') THEN
    CREATE POLICY "content_types_write" ON public.content_types
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'marketing')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'marketing')));
  END IF;
END $$;

-- 5. Seed content_types (safe with ON CONFLICT DO NOTHING)
INSERT INTO public.content_types (key, label, color_classes, sort_order) VALUES
  ('blog',         'Blog / Article', 'bg-blue-100 text-blue-700 border-blue-200',       1),
  ('catalogue',    'Catalogue',      'bg-cyan-100 text-cyan-700 border-cyan-200',        2),
  ('ebook',        'eBook',          'bg-pink-100 text-pink-700 border-pink-200',        3),
  ('emailer',      'Emailer',        'bg-yellow-100 text-yellow-700 border-yellow-200',  4),
  ('flier',        'Flier',          'bg-lime-100 text-lime-700 border-lime-200',        5),
  ('graphic',      'Graphic',        'bg-violet-100 text-violet-700 border-violet-200',  6),
  ('image',        'Photo',          'bg-green-100 text-green-700 border-green-200',     7),
  ('other',        'Other',          'bg-gray-100 text-gray-700 border-gray-200',        8),
  ('pdf',          'PDF',            'bg-orange-100 text-orange-700 border-orange-200',  9),
  ('poster',       'Poster',         'bg-teal-100 text-teal-700 border-teal-200',       10),
  ('presentation', 'Presentation',   'bg-purple-100 text-purple-700 border-purple-200', 11),
  ('video',        'YouTube',        'bg-red-100 text-red-700 border-red-200',          12),
  ('video_file',   'Video File',     'bg-rose-100 text-rose-700 border-rose-200',       13),
  ('whitepaper',   'Whitepaper',     'bg-indigo-100 text-indigo-700 border-indigo-200', 14)
ON CONFLICT (key) DO NOTHING;

-- 6. Add file_urls column for multiple-files-per-posting support
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS file_urls text[] NOT NULL DEFAULT '{}';

-- 7. Reload PostgREST schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';
