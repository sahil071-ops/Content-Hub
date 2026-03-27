-- ============================================================
-- Migration 011: Add 'language' value to tag_type_enum
-- ============================================================
-- Run this FIRST (Step 1 of 2) and wait for it to commit
-- before running migration 012.

ALTER TYPE tag_type_enum ADD VALUE IF NOT EXISTS 'language';
