# Axis Content Hub — Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.4.0] — 2026-04-03

### Fixed — LinkedIn post dates
- `emptyRow()` now defaults `post_date` to empty string instead of today's date
- Date fields show a warning when the value is in the future or more than 3 years ago
- Post Library table columns (Date, Impressions, Engagement Rate, Reactions, Comments, Shares) are now sortable; default sort is post date descending

### Fixed — LinkedIn AI Insights payload size
- API now sends only the 50 most recent posts to Claude; older posts are aggregated into a summary (count, avg engagement, top impressions per account)
- Post summaries trimmed to essential fields + 300-char text preview to reduce token usage significantly
- Insight generation errors are now surfaced in the UI (amber alert box) instead of silently failing

### Fixed — AI lead scoring not learning from feedback
- `deriveLearnedRules()` function added to `lib/crm/spam-detector.ts` — extracts hard rules (e.g. free-email domain bans) from user notes and injects them into the Claude prompt as strict constraints
- Derived rules displayed on the AI Learnings page under "Derived Rules — Active Now"
- Cron job (`/api/cron/process-leads`) re-applies derived rules to unreviewed leads every 15 minutes

### Fixed — Zoho leads missing submission dates
- `submitted_at` column added to `leads` table (migration 013), backfilled from `zoho_created_at → zoho_modified_at → pulled_at`
- `date_estimated` boolean flag set when real submission date was unavailable
- Lead Library sorted by `submitted_at` descending; estimated dates shown with an amber italic label
- Supabase migration: `013_leads_submitted_at.sql`

### Fixed — YouTube showing zeros for subscribers / watch time
- Zero-value subscriber and watch-time cards are now hidden instead of showing confusing zeroes
- When watch time is unavailable a "Requires YouTube account connection" message card is shown instead

### Fixed — Brevo API connection errors
- Error logging in `lib/analytics/brevo.ts` now includes URL path, HTTP status code, and first 500 chars of the response body for easier diagnosis

### Added — Email verification via Abstract API
- `lib/crm/email-verifier.ts` — calls `emailvalidation.abstractapi.com` to check deliverability, format validity, and disposable-domain status
- `verifyEmail()` called on inbound Zoho leads when `ABSTRACT_API_KEY` env var is set
- Disposable email addresses increment spam score by 25 and append a reason
- Email verification badges shown in Lead Library (green tick, red shield, amber question mark)
- Supabase migration: `014_lead_email_verification.sql`

### Added — Language Tags
- New `language` tag type for multi-language content tagging
- Upload form, library filters, and content detail page all support language tags
- Supabase migrations: `011_language_tags.sql`, `012_language_tags_data.sql`

### Added — Vercel Cron Jobs
- `/api/cron/pull-zoho-leads` — runs every 4 hours, delegates to `/api/zoho/pull`
- `/api/cron/process-leads` — runs every 15 minutes, re-evaluates unreviewed leads with latest feedback and derived rules
- Both routes protected by `CRON_SECRET` Bearer header
- Schedules registered in `vercel.json`

### Added — Main Dashboard (`/dashboard`)
- New server page + client component replacing the default app home
- **AI Highlights** section: 2-column expandable cards tagged WIN / PROBLEM / OPPORTUNITY / WATCH with thumbs feedback
- **Number Strip**: 5 hero metrics (Organic Sessions, Search Clicks, YouTube Views, Email Open Rate, New Leads) with period-on-period delta arrows
- **Detail Cards**: 5 collapsible sections (YouTube, Website/GA4, Spanish Site, Email/Brevo, Leads) showing full data breakdown
- Period toggle: Weekly / Monthly / Quarterly / Annual
- "Pull now" button to trigger a fresh data pull
- Default app home (`app/(app)/page.tsx`) redirects to `/dashboard`
- Dashboard link added to sidebar (admin / marketing roles)

---

## [v0.3.0] — 2026-03-25

### Added — Favicon
- App favicon (`app/icon.svg`) — blue "A" on brand-colour background, auto-picked up by Next.js

### Added — CRM Leads improvements
- Company domain extracted from non-free email addresses shown as clickable link in lead detail
- "Find on LinkedIn" search link generated for non-spam leads with name + company context
- All external links (domain, LinkedIn, website) open in new tab

### Added — Content previews for all types
- PDFs: ebook, whitepaper, catalogue, flier, presentation, emailer now all render with the PDF iframe viewer
- Images: graphic, poster now render inline
- Video files: video_file type with a file URL now shows an HTML5 video player
- Extension-based fallback: any content type with a `.pdf`, `.jpg`, `.png` etc URL shows a preview automatically

### Changed — MIS Dashboard Redesign (v0.3.0)

**General**
- Every section now answers one clear question in the header (e.g. "Is our channel growing?")
- Each section has a coloured left border matching its source: YouTube = red, GA4 = blue, Search Console = green, Brevo = teal
- Auto-generated one-line plain English summary beneath the headline numbers in every section
- AI Highlights moved to full-width section at the very top (most valuable content first)
- Dashboard controls (period selector, India toggle, Pull button) are now sticky as user scrolls
- Mini navigation bar below sticky controls lets you jump to any section
- "Last updated" timestamp shown prominently in sticky bar

**AI Highlights**
- New system prompt with full company context (Axis India, B2B industrial tech, India focus)
- Each highlight now tagged as WIN / PROBLEM / OPPORTUNITY / WATCH with colour coding
- WIN = green, PROBLEM = red, OPPORTUNITY = amber, WATCH = blue
- Highlights shown in a 2-column grid with larger, more readable cards
- Supporting data points collapsible below each card
- Feedback buttons redesigned to be more prominent
- `HighlightItem` type extended with `tag` and `data_points` fields (backward compatible)

**YouTube Section**
- Hero number: total channel subscribers (most stable growth signal available via API key)
- Secondary: period views, avg views/video, watch time (with clear note when unavailable)
- Top 5 videos shown as visual bar-list with thumbnail + proportional view bar + YouTube link on hover
- Removed "Channel Total Views" scorecard (vanity metric)
- Clear note explaining watch time/timeline limitations of YouTube Data API v3 (no OAuth)

**GA4 Section**
- Hero: Organic sessions with delta vs previous period (colour coded green/red)
- Prominent India callout: "🇮🇳 68% of traffic is from India" with session count
- New/returning shown as two numbers side by side (percentage each) instead of bar
- Country chart uses top 8 countries, taller height
- Sessions timeline chart increased to 260px height for better trend visibility

**Search Console Section**
- 4-across hero row: Clicks, Impressions, Avg CTR, Avg Position — all with deltas
- CTR Opportunity box (amber): automatically surfaces queries with >500 impressions but <1% CTR
- Top Queries table: colour-coded CTR badges (green ≥5%, amber 1-5%, red <1%), alternating rows
- Top Pages table: Opportunity Score column (impressions ÷ clicks), top 3 opportunities highlighted
- Links in pages table open in new tab
- Clicks over time line chart (when timeline data available)

**Brevo Section**
- Hero: Avg open rate with B2B industry benchmark comparison (22%)
- Open Rate column colour-coded: green ≥25%, amber 15-25%, red <15%
- High unsubscribe campaigns now flagged in red (was amber)
- Open rate + click rate trend line chart across campaigns
- Send dates shown in campaign table

### Fixed
- `GscSnapshotData` usage: added `impressions_prev` fallback for delta display
- MIS page passes `lastPullTime` (most recent snapshot `created_at`) to client for display

---

## [v0.2.0] — 2026-03-20

### Added — Phase 2a: Content Analytics Hub

- New page `/analytics/content` — visual analytics layer over the existing content library
- **Scorecard row**: total items with published/draft/archived breakdown, items added this month vs last month, coverage score (% of products with all major content types), content type count
- **Interactive bar charts**: pieces by product tag, pieces by topic tag, audience coverage breakdown — all clickable to drill into the library with pre-applied filters
- **Content type donut chart**: clickable slices navigate to filtered library view
- **Output over time**: monthly/weekly toggle line chart showing content creation velocity over 12 months
- **Product × Content Type heatmap**: matrix showing which products have which content types covered; red cells highlight gaps; click any cell to view those items
- **Target Split Tracker**: admins can set target percentage allocations per product tag; dashboard shows actual vs target as progress bars with gap warnings; targets stored in `content_targets` table and editable from UI
- All charts built with Recharts; no external analytics service needed — purely from existing Supabase data

### Added — Phase 2b: Marketing MIS Dashboard

- New page `/analytics/mis` — unified weekly marketing performance dashboard
- **Data sources**: Google Analytics 4 (two properties), Google Search Console (two properties + India-specific view), YouTube Analytics, Brevo email marketing
- **Data architecture**: all pulled data stored as JSONB snapshots in Supabase (`mis_snapshots` table); frontend reads from snapshot store — no live API calls on page load
- **Automated pull schedule** via Vercel Cron Jobs:
  - Weekly: every Monday 6:00 AM IST
  - Monthly: 1st of month 6:00 AM IST
  - Quarterly: 1st of Jan/Apr/Jul/Oct 6:00 AM IST
  - Annual: 1st of January 6:00 AM IST
- **Manual pull button** (admin only) — triggers full pull immediately and refreshes the page
- **Pull logging**: all pull attempts logged to `mis_pull_logs` with source, period type, status, and error message
- **Comparison toggle**: last week / last month / last quarter / last year
- **Country filter**: overall / India toggle applies to GA4 and Search Console simultaneously
- **Per-source widgets**: YouTube (views, subscribers, watch time, top 5 videos, timeline), Search Console (clicks, impressions, CTR, position, top queries, top pages, India view), GA4 (organic sessions, new/returning split, top countries, sessions timeline), Brevo (campaign list, avg open/click/CTOR rates, unsubscribe warnings)
- **Unsubscribe rate warning**: amber/red flag on any Brevo campaign exceeding 0.5% unsubscribe rate

### Added — AI Highlights Panel

- Sits at the top of the MIS dashboard, always visible
- Automatically generated by Claude (claude-sonnet-4-6) after each data pull
- Analyses all source data and produces 3–5 plain-English insights with source badges and sentiment (positive / warning / anomaly)
- Highlights stored in `mis_highlights` table for historical viewing
- Thumbs up / thumbs down feedback on each highlight stored in Supabase for future learning

### Added — Configurable Dashboard

- Every MIS widget can be shown or hidden via a settings panel
- Widget order rearrangeable via drag-and-drop (built with `@dnd-kit/core` and `@dnd-kit/sortable`)
- Each user's layout saved to `dashboard_configs` table, restored on next login
- Admins can set a default layout for all users
- "Reset to default" button restores the admin-defined default
- Extensible: new widgets added in future phases register automatically without schema changes

### Added — Pull History page

- New page `/analytics/mis/history` — shows all stored snapshots and pull logs
- Filterable by source and period type
- Shows error messages for failed pulls to aid debugging

### Added — Analytics navigation section

- New "Analytics" section in the sidebar with:
  - Content Analytics (`/analytics/content`) — visible to admin, marketing, sales
  - MIS Dashboard (`/analytics/mis`) — visible to admin, marketing
  - Pull History (`/analytics/mis/history`) — visible to admin, marketing

### Database

- Migration `006_analytics.sql` adds five new tables:
  - `mis_snapshots` — JSONB snapshot store for all external data pulls
  - `mis_pull_logs` — pull attempt log with status and error tracking
  - `mis_highlights` — AI-generated insights with user feedback storage
  - `content_targets` — admin-configurable target % per product tag
  - `dashboard_configs` — per-user (and default) MIS dashboard layout config
- Full RLS on all new tables; admin-only writes, role-appropriate reads

### Dependencies added

- `recharts` ^2.x — chart library for all analytics visualisations
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop dashboard layout
- `@anthropic-ai/sdk` — Claude API for AI Highlights generation
- `googleapis` — Google Analytics 4, Search Console, YouTube Analytics APIs
- `date-fns` — date range calculations for period comparisons

### Infrastructure

- `vercel.json` added — configures four Vercel Cron Jobs for automated weekly/monthly/quarterly/annual data pulls
- `CRON_SECRET` env var for cron job authentication

---

## [v0.1.1] — 2026-03-11

### Fixed
- **Auth callback route missing**: Added `/app/auth/callback/route.ts` to exchange Supabase PKCE auth codes for sessions. Without this, magic link sign-in redirected users back to `/login` as if unauthenticated.
- **Login redirect URL**: Changed `emailRedirectTo` from `/library` to `/auth/callback?next=/library` so Supabase correctly routes through the code exchange handler.
- **Expired link error**: Login page now shows a human-readable message ("The sign-in link has expired or already been used") when redirected back after a failed callback.
- **Middleware public paths**: Added `/auth/callback` to the list of paths that don't require authentication, so the callback route itself is accessible.
- **Setup guide**: Added Step 19 explaining how to whitelist `{app-url}/auth/callback` in Supabase Auth → URL Configuration → Redirect URLs (required for magic links to work).

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
