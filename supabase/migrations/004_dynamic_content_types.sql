-- Migration 004: Dynamic content types
-- Converts content_type from a PostgreSQL enum to free text,
-- and adds a content_types registry table that admins can manage via UI.
-- Run this in Supabase SQL Editor.

-- 1. Change content_type column from enum to plain text
ALTER TABLE public.content_items
  ALTER COLUMN content_type TYPE text USING content_type::text;

-- 2. Create the content_types registry table
CREATE TABLE IF NOT EXISTS public.content_types (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key          text UNIQUE NOT NULL,
  label        text NOT NULL,
  color_classes text NOT NULL DEFAULT 'bg-gray-100 text-gray-700 border-gray-200',
  sort_order   smallint NOT NULL DEFAULT 99,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Enable RLS (read access for all authenticated users, write for admin/marketing)
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_types_read" ON public.content_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "content_types_write" ON public.content_types
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'marketing')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'marketing')
    )
  );

-- 3. Seed with all existing content types
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
