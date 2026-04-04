# Axis Content Hub — Project Documentation

> **Single source of truth.** Read this file before touching any other file in a session.
> Keep every entry concise. Max 500 lines — summarise old session log entries when needed.

---

## Project Overview

Axis Content Hub is a B2B marketing intelligence and content management platform built for Axis (industrial technology, India-focus). It centralises content storage and distribution, pulls marketing analytics from GA4 / Search Console / YouTube / Brevo, manages inbound Zoho CRM leads with AI enrichment and spam scoring, and tracks LinkedIn performance. Built on **Next.js 14 App Router** (TypeScript), **Supabase** (Postgres + Auth + RLS), **Cloudflare R2** (primary storage), **Backblaze B2** (backup), and deployed on **Vercel** with cron jobs. AI features use **Anthropic Claude** (claude-sonnet-4-6 / claude-haiku). Deployed URL: not yet confirmed — check `NEXT_PUBLIC_APP_URL` in Vercel dashboard.

---

## Current Version & Changelog Summary

**Current version: 0.5.0** (package.json)

| Version | Date | Summary |
|---------|------|---------|
| v0.5.0 | 2026-04-04 | Snapshot-based historical tracking, Trends dashboard, AI highlights from 8-week history, YouTube subscriber growth, Brevo diagnostic |
| v0.4.0 | 2026-04-03 | Dashboard redesign, 6 bug fixes, email verification, cron jobs, language tags |
| v0.3.0 | 2026-03-25 | MIS dashboard redesign, favicon, content previews, CRM lead detail improvements |
| v0.2.0 | — | LinkedIn tracker, Zoho CRM integration, AI lead enrichment |
| v0.1.0 | — | Content library, upload, R2/B2 storage, Supabase auth, admin tools |

---

## Full Route Map

### Pages
```
/                             → Redirects to /dashboard
/dashboard                    → Main command centre, default landing page
/library                      → Browse and filter all content
/library/[id]                 → Single content item detail view
/upload                       → Single file upload form
/upload/batch                 → Batch multi-file upload
/upload/youtube               → Import YouTube videos by URL
/upload/blogs                 → Import and archive blog posts
/analytics/content            → Content view analytics and targets
/analytics/mis                → MIS dashboard: GA4, GSC, YouTube, Brevo
/analytics/mis/history        → Historical MIS pull log viewer
/analytics/trends             → Historical Trends dashboard (6 charts from metric_snapshots)
/linkedin                     → LinkedIn post library (sortable table)
/linkedin/add                 → Add / bulk-add LinkedIn posts
/linkedin/dashboard           → LinkedIn performance summary
/linkedin/insights            → AI-generated insights from posts
/leads                        → CRM lead library with email badges
/leads/learnings              → AI feedback patterns and derived rules
/admin/users                  → User management and role assignment
/admin/tags                   → Tag management (all tag types)
/admin/content-types          → Dynamic content type registry
/admin/zoho                   → Zoho OAuth connection and status
/admin/linkedin               → LinkedIn account configuration
/admin/backup-logs            → R2→B2 backup attempt history
/login                        → Supabase magic link login
```

### API Routes
```
/api/content                  → Public: fetch published content (CORS)
/api/content/[id]/thumbnail   → POST: generate PDF thumbnail
/api/upload/presign           → POST: get R2 presigned upload URL
/api/upload/complete          → POST/PATCH: register upload in database
/api/tags                     → GET/POST: manage tags master list
/api/me                       → GET: current user profile
/api/version                  → GET: app version and build info
/api/youtube                  → GET: oEmbed metadata, no auth required
/api/blog-archive             → POST: archive blog post to content_items
/api/blog-crawl               → POST: crawl URL and extract content
/api/backup                   → POST: trigger R2→B2 backup
/api/admin/users              → DELETE: remove user account
/api/admin/invite             → POST: invite new user by email
/api/admin/content-types      → CRUD: content type registry
/api/analytics/pull           → POST: manually pull all analytics sources
/api/analytics/test-brevo     → POST: test Brevo API connection
/api/analytics/dashboard-config → GET/POST/PUT: save dashboard layout
/api/analytics/targets        → GET/POST/PUT: content tag targets
/api/analytics/highlights/feedback → POST: thumbs up/down on highlights
/api/linkedin/accounts        → CRUD: LinkedIn account management
/api/linkedin/posts           → CRUD: LinkedIn post management
/api/linkedin/parse-xlsx      → POST: parse metrics from XLSX upload
/api/linkedin/extract         → POST: Claude Vision metric extraction
/api/linkedin/suggestions     → POST: Claude content suggestions
/api/linkedin/insights        → POST: Claude insights from post history
/api/zoho/auth                → GET: initiate Zoho OAuth flow
/api/zoho/callback            → GET: Zoho OAuth callback handler
/api/zoho/status              → GET: check Zoho connection status
/api/zoho/pull                → POST: manually pull leads from Zoho
/api/zoho/disconnect          → POST: revoke Zoho tokens
/api/leads                    → GET/POST: query or create leads
/api/leads/[id]               → GET/PUT/DELETE: single lead operations
/api/leads/[id]/enrich        → POST: trigger Claude enrichment
/api/leads/[id]/feedback      → POST: spam/quality feedback
/api/leads/reevaluate         → POST: bulk re-score all leads
/api/leads/stats              → GET: lead counts by status/quality
/api/leads/feedback           → GET: all feedback records
/api/leads/learnings          → GET: derived rules + feedback summary
/api/cron/mis                 → GET: pull analytics (period= param)
/api/cron/snapshot-weekly     → GET: weekly snapshot pull (Mondays 02:30 UTC), CRON_SECRET auth
/api/cron/snapshot-monthly    → GET: monthly snapshot pull (1st 03:30 UTC), CRON_SECRET auth
/api/leads/wpforms            → POST: WPForms webhook, processes lead synchronously
/api/cron/process-leads       → GET: manual ad-hoc re-evaluation (not in cron schedule)
/api/cron/pull-zoho-leads     → GET: daily Zoho pull (2:00 AM UTC)
```

---

## Database Schema Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User profiles extending auth.users | id, full_name, role, avatar_url |
| `tags_master` | All tags across all types | id, name, tag_type, color |
| `content_types` | Admin-managed content type registry | key, label, color_classes, sort_order, is_active |
| `content_items` | Core content repository | id, title, content_type, file_url, file_urls, product_tags, topic_tags, language_tags, audience_tags, medium_tags, status, thumbnail_url, meta (JSONB) |
| `content_views` | View event log (Phase 3 placeholder) | content_id, viewer_role, viewed_at, session_id |
| `backup_logs` | R2→B2 backup attempts | content_id, r2_url, b2_url, status, error_message |
| `mis_snapshots` | Analytics data by source/period (legacy) | source, property, period_type, period_start, period_end, data (JSONB) |
| `mis_pull_logs` | Log of each analytics pull | status, error_message, pulled_at |
| `mis_highlights` | AI-generated marketing highlights | period_start/end, highlights (JSONB array), feedback (JSONB) |
| `metric_snapshots` | Normalised metrics per source per pull (migration 015) | snapshot_type, period_start, period_end, source, metrics (JSONB); index on (snapshot_type, source, period_start) |
| `youtube_snapshots` | Point-in-time subscriber count at each pull (migration 015) | subscriber_count, total_view_count, pulled_at |
| `content_targets` | Target % by tag for content mix | tag_name, tag_type, target_percentage |
| `dashboard_configs` | User dashboard layout preferences | user_id, dashboard_name, config (JSONB) |
| `linkedin_accounts` | LinkedIn accounts tracked | name, account_type, profile_url, is_active |
| `linkedin_posts` | LinkedIn posts with metrics | account_id, post_date, post_text, format, impressions, reactions, comments, shares, engagement_rate (auto-computed trigger) |
| `linkedin_ai_insights` | Claude-generated post insights | account_id, insight_type, content, supporting_post_ids, thumbs_up |
| `zoho_connections` | Zoho OAuth tokens (one active) | data_center, access_token, refresh_token, token_expires_at, is_active |
| `leads` | CRM leads from Zoho | zoho_id, email, company, title, is_spam, spam_score, spam_reasons, quality_score, is_high_value, submitted_at, date_estimated, email_valid, email_disposable, email_deliverable, enrichment_status |
| `lead_enrichments` | Claude enrichment results per lead | lead_id, company_summary, likely_use_case, recommended_products, talking_points, deal_potential |
| `lead_feedback` | User corrections for AI retraining | lead_id, was_spam, quality_override, notes |

---

## Environment Variables

| Variable | Purpose | Status |
|----------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser key | ✅ Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-side key | ✅ Required |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. https://…vercel.app) | ✅ Required |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | ✅ Required |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | ✅ Required |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret | ✅ Required |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | ✅ Required |
| `R2_PUBLIC_URL` | Public CDN URL for R2 bucket | ✅ Required |
| `B2_ENDPOINT` | Backblaze B2 S3-compatible endpoint | ✅ Required |
| `B2_ACCESS_KEY_ID` | Backblaze B2 access key | ✅ Required |
| `B2_SECRET_ACCESS_KEY` | Backblaze B2 secret | ✅ Required |
| `B2_BUCKET_NAME` | Backblaze B2 bucket name | ✅ Required |
| `CRON_SECRET` | Bearer token for Vercel cron routes | ✅ Required |
| `ANTHROPIC_API_KEY` | Claude API — enrichment, insights, spam | ⚠️ Optional but most AI features fail without it |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP service account for GA4/GSC | ⚠️ Optional — analytics MIS won't pull |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | GCP service account private key (PEM) | ⚠️ Optional — Vercel encoding quirks handled in google-auth.ts |
| `GA4_PROPERTY_ID_MAIN` | GA4 numeric property ID, main site | ⚠️ Optional |
| `GA4_PROPERTY_ID_ES` | GA4 numeric property ID, Spanish site | ⚠️ Optional |
| `GSC_SITE_URL_MAIN` | Search Console site URL (exact match) | ⚠️ Optional |
| `GSC_SITE_URL_ES` | Search Console site URL, Spanish | ⚠️ Optional |
| `YOUTUBE_CHANNEL_ID` | YouTube channel ID (UCxxx…) | ⚠️ Optional |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | ⚠️ Optional |
| `BREVO_API_KEY` | Brevo v3 API key (xkeysib-…) | ⚠️ Partial — connection issues under investigation |
| `ZOHO_CLIENT_ID` | Zoho OAuth app client ID | ⚠️ Optional — leads won't pull |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth app client secret | ⚠️ Optional |
| `ZOHO_REDIRECT_URI` | Zoho OAuth callback URL | ⚠️ Optional |
| `ABSTRACT_API_KEY` | Abstract API email verification | ⚠️ Optional — email badges won't show (100/day free) |
| `WPFORMS_WEBHOOK_SECRET` | Shared secret for WPForms webhook auth | ⚠️ Optional but strongly recommended in production |

---

## External Integrations

| Integration | Auth Method | Key Files | Status |
|-------------|-------------|-----------|--------|
| **Cloudflare R2** | AWS SDK, access key + secret | `lib/storage/r2.ts` | ✅ Working |
| **Backblaze B2** | AWS S3-compatible, access key + secret | `lib/storage/b2.ts` | ✅ Working |
| **Google Analytics 4** | Service account JWT via `googleapis` | `lib/analytics/ga4.ts`, `lib/analytics/google-auth.ts` | ✅ Working |
| **Google Search Console** | Service account JWT via `googleapis` | `lib/analytics/search-console.ts` | ✅ Working |
| **YouTube Data API v3** | Public API key (no OAuth) | `lib/analytics/youtube.ts`, `app/api/youtube/route.ts` | ⚠️ Partial — per-period view counts unavailable without OAuth |
| **Brevo** | `api-key` header (v3) | `lib/analytics/brevo.ts` | ⚠️ Unreliable — enhanced error logging added in v0.4.0 |
| **Zoho CRM** | OAuth 2.0, auto token refresh | `lib/crm/zoho-client.ts`, `app/api/zoho/` | ✅ Working |
| **Claude (Anthropic)** | API key, Bearer header | `lib/crm/enricher.ts`, `lib/crm/spam-detector.ts`, `lib/analytics/ai-highlights.ts`, `app/api/linkedin/` | ✅ Working |
| **Abstract API** | API key in query param | `lib/crm/email-verifier.ts` | ✅ Working (100/day free limit) |
| **Google oEmbed / YouTube oEmbed** | None | `app/api/youtube/route.ts` | ✅ Working |

---

## Known Issues & Tech Debt

1. **Brevo connectivity** — API key and headers are correct; root cause of intermittent failures not yet identified. Enhanced error logging (status + body) added in v0.4.0 to aid diagnosis. Check Vercel function logs after next pull attempt.
2. **YouTube per-period watch time** — YouTube Data API v3 with an API key cannot return per-period watch time; requires OAuth (YouTube Analytics API). Zero-value cards now hidden. Fix: add OAuth flow for YouTube.
3. **Abstract API rate limit** — Free tier is 100 verifications/day. High-volume Zoho pulls may exhaust this. Paid plan needed for production scale.
4. **Google private key encoding on Vercel** — PEM key requires special handling (see `lib/analytics/google-auth.ts`). If GA4/GSC stops working after a re-deploy, check that the env var hasn't been re-escaped.
5. **PostgreSQL enum add-value transaction constraint** — `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction as statements referencing the new value. Always split into two separate migration files run sequentially (see migrations 011/012).
6. **`content_type` column is now free text** (was enum, changed in migration 004). Some older code may still cast it as `ContentTypeEnum` — use `string` type in new code.
7. **AI insights need 2+ snapshot periods** — `generateMisHighlights()` returns a "not enough data" placeholder until at least 2 weekly (or monthly) pulls have been stored in `metric_snapshots`. Insights improve with more history — full 8-week context available after 8 weekly pulls.
8. **No `.env.example` file** — environment variable documentation lives only in this file. Consider creating one.

---

## Key Files Index

```
app/(app)/page.tsx                          → Redirects / to /dashboard
app/(app)/dashboard/page.tsx               → Dashboard server component, data fetch
app/(app)/dashboard/dashboard-client.tsx   → Dashboard UI: highlights, strip, detail cards
app/(app)/analytics/mis/page.tsx           → MIS server page, snapshot fetch
app/(app)/leads/page.tsx                   → Lead library with email badges
app/(app)/linkedin/page.tsx                → LinkedIn post table, sortable columns
app/(app)/linkedin/add/page.tsx            → Add posts with date validation
app/api/analytics/pull/route.ts            → Orchestrates all analytics source pulls
app/api/zoho/pull/route.ts                 → Pulls leads from Zoho, email verify, spam score
app/api/linkedin/insights/route.ts         → Claude insights (capped 50 posts)
app/api/leads/wpforms/route.ts             → WPForms webhook: saves lead, runs spam/quality sync
app/api/cron/process-leads/route.ts        → Manual re-evaluation trigger (not a registered cron)
app/api/cron/pull-zoho-leads/route.ts      → Delegates Zoho pull, runs once daily at 2:00 AM UTC
lib/storage/r2.ts                          → Cloudflare R2 client, presign, upload, delete
lib/storage/b2.ts                          → Backblaze B2 client, backup upload
lib/analytics/ga4.ts                       → GA4 data fetch (sessions, countries, timeline)
lib/analytics/search-console.ts            → GSC data fetch (clicks, impressions, queries)
lib/analytics/youtube.ts                   → YouTube channel stats and top videos
lib/analytics/brevo.ts                     → Brevo email campaign stats fetch
lib/analytics/google-auth.ts              → GCP service account JWT (handles Vercel encoding)
lib/analytics/ai-highlights.ts             → Claude-generated MIS highlights (uses 8-week metric_snapshots history)
lib/analytics/snapshot-store.ts            → Normalises pull results into metric_snapshots + youtube_snapshots
lib/crm/zoho-client.ts                     → Zoho OAuth client, token refresh, lead fetch
lib/crm/enricher.ts                        → Claude lead enrichment (company/product analysis)
lib/crm/spam-detector.ts                   → Heuristic + Claude spam scoring + deriveLearnedRules()
lib/crm/email-verifier.ts                  → Abstract API email verification
components/layout/app-sidebar.tsx          → Sidebar nav, all sections, role filtering
components/layout/app-shell.tsx            → Authenticated layout wrapper
components/analytics/mis/mis-dashboard-client.tsx → MIS dashboard state and layout
components/analytics/ai-highlights-panel.tsx → Highlight cards with thumbs feedback
types/database.ts                          → All TypeScript types for DB rows and enums
supabase/migrations/                       → All 15 SQL migrations, run in order
scripts/backfill-snapshots.ts              → One-time backfill from mis_snapshots → metric_snapshots (run with npx tsx)
vercel.json                                → Cron job schedules (5 jobs, all once/day or less)
```

---

## Component Map

| Component | Pages |
|-----------|-------|
| `AppSidebar` | All authenticated pages |
| `AppShell` | All authenticated pages |
| `SystemHealthBanner` | All authenticated pages (shows missing env vars) |
| `MisDashboardClient` | `/analytics/mis` |
| `AiHighlightsPanel` | `/analytics/mis`, `/dashboard` |
| `DashboardClient` | `/dashboard` |
| `ContentGrid` + `ContentCard` | `/library` |
| `ContentFilters` + `ContentSearch` | `/library` |
| `UploadForm` | `/upload` |
| `BatchUploadForm` | `/upload/batch` |
| `PostDetailPanel` | `/linkedin` |
| `TagsManager` | `/admin/tags` |
| `UsersManager` | `/admin/users` |
| `ContentTypesManager` | `/admin/content-types` |
| `RechartsBar`, `RechartsLine` | `/analytics/*`, `/dashboard` |

---

## Session Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-04 | v0.5.0 | Parts 1-6: Brevo diagnostic endpoint + UI button; metric_snapshots + youtube_snapshots tables (migration 015); snapshot-weekly + snapshot-monthly cron endpoints; manual pull writes to metric_snapshots; dashboard comparison uses snapshot deltas; YouTube subscriber growth from snapshots; /analytics/trends page (6 charts); AI highlights rewritten to use 8-week snapshot history; backfill script for legacy mis_snapshots |
| 2026-04-03 | v0.4.0 | Fixed 6 bugs (LinkedIn dates/payload/AI rules/Zoho dates/YouTube zeros/Brevo errors); added email verification via Abstract API; added language tags; added Vercel cron jobs; rebuilt /dashboard with AI highlights + number strip + detail cards; added PROJECT_DOCS.md |
| 2026-04-03 | v0.4.0 | Fixed Vercel Hobby plan cron limit: removed process-leads (*/15) and pull-zoho-leads (*/4h) from schedule; added /api/leads/wpforms webhook for synchronous WPForms lead processing; Zoho pull moved to once daily (0 2 * * *); 5 crons remain, all ≤ once/day |
