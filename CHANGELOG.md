# Axis Content Hub — Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.1.0] — 2026-03-11

### Added — Phase 1 Initial Build

**Foundation**
- Next.js 14 App Router project with TypeScript, Tailwind CSS, and shadcn/ui
- Axis brand colour system: Dark Blue (#2323A3), Light Blue (#59A7F1), Red (#FF0004 — used sparingly), Grey (#3D3D3D)
- Version tracking via `lib/version.ts`, `package.json`, and CHANGELOG
- Service worker for automatic update detection with toast notifications
- Auto-reload on new deployment detection (no manual browser refresh needed)
- Version number displayed in app footer on every page

**Authentication**
- Supabase Auth with magic link (passwordless email sign-in)
- Session management via `@supabase/ssr` middleware
- Auto-redirect authenticated users away from login page

**Database**
- Complete Supabase Postgres schema with enums, indexes, and RLS policies
- Tables: `users`, `tags_master`, `content_items`, `content_views`, `backup_logs`
- Enums: `content_type_enum`, `audience_tag_enum`, `content_status_enum`, `user_role_enum`, `tag_type_enum`, `backup_status_enum`
- Full-text search indexes using pg_trgm
- Auto-generated user profiles on sign-up via trigger
- Auto-updated `updated_at` timestamps via trigger

**User Roles & Access Control**
- 5 roles: Admin, Marketing, Sales, Distributor, Viewer
- All access control enforced at database level using Row Level Security
- Frontend role checks for UX only (hiding/showing UI elements)

**Content Library**
- Grid and list view toggle
- Full-text search across title and description
- Filter panel: content type, product tags, topic tags, audience, status
- Sort by: newest, oldest, recently updated
- Loading skeleton states
- Empty state with helpful CTA
- Each card shows: thumbnail, title, content type badge, product tags, date, copy-link button

**Content Detail Page**
- PDF preview via native browser iframe embed
- YouTube video embed
- Image viewer
- Archived blog content display
- Download button for uploadable files
- Copy shareable link
- Edit button (admin/marketing only)
- Related content section (same product tags)
- View tracking (records to `content_views` for Phase 3 analytics)

**Upload Flow**
- Drag-and-drop file upload via `react-dropzone`
- Direct upload to Cloudflare R2 using presigned URLs (client → R2, no server bottleneck)
- Async backup to Backblaze B2 (non-blocking, user doesn't wait)
- YouTube URL input with oEmbed auto-fetch (title, thumbnail, embed HTML)
- Blog URL archiving: server-side fetch, HTML parsing, text extraction, stored in `meta` JSONB
- Blog content type supports both file upload AND/OR URL archiving simultaneously
- Auto-generate PDF thumbnail from first page using pdf.js (client-side)
- Tag assignment during upload: product, topic, audience tags
- Status: draft or publish
- All errors display human-readable explanations with specific missing credential guidance

**File Storage**
- Cloudflare R2: presigned PUT uploads with S3-compatible SDK
- File path structure: `/{content_type}/{year}/{month}/{uuid}-{filename}`
- Backblaze B2: automatic async backup mirroring R2 path structure
- Backup status logged to `backup_logs` table with success/failure/pending status

**Tag Management (Admin)**
- Full CRUD for `tags_master` table
- Tag types: product, topic, audience, content_type
- Colour picker with Axis brand palette presets
- Delete protection: warns and blocks if tag is in active use

**User Management (Admin)**
- View all users with email, name, role, join date
- Invite users by email (Supabase magic link)
- Assign/change roles inline
- Cannot demote yourself from admin

**Backup Monitor (Admin)**
- Table of all backup operations with status, error messages
- Summary stats (success/failed/pending counts)
- Retry button for failed backups with clear error display
- Tooltips for full error message on truncated rows

**Public API (Phase 2 Ready)**
- `GET /api/content` — returns published public/distributor content
- Supports query params: `?product=`, `?type=`, `?audience=`, `?limit=`, `?offset=`
- Full CORS headers — callable from any external website
- No authentication required for public-audience content

**Navigation**
- `/` → redirects to `/library`
- `/library` — main content library
- `/library/[id]` — content detail page
- `/upload` — upload flow (admin + marketing)
- `/admin/tags` — tag management (admin)
- `/admin/users` — user management (admin)
- `/admin/backup-logs` — backup monitor (admin)
- `/api/content` — public REST API
- `/api/version` — version endpoint (used by service worker)

**Developer Experience**
- `.env.example` with all required variables documented
- Clear error messages when any environment variable is missing
- TypeScript types matching database schema exactly
- SQL migration file ready to paste and run in Supabase SQL Editor
