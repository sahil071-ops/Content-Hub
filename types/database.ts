// ============================================================
// AXIS CONTENT HUB — TypeScript Database Types
// Mirrors the Supabase schema exactly.
// ============================================================

export type ContentTypeEnum =
  | 'video'
  | 'video_file'
  | 'pdf'
  | 'image'
  | 'presentation'
  | 'emailer'
  | 'blog'
  | 'whitepaper'
  | 'ebook'
  | 'poster'
  | 'catalogue'
  | 'flier'
  | 'graphic'
  | 'other';

export type AudienceTagEnum =
  | 'internal'
  | 'sales'
  | 'distributor'
  | 'end-client'
  | 'public';

export type ContentStatusEnum = 'draft' | 'published' | 'archived';

export type UserRoleEnum = 'admin' | 'marketing' | 'sales' | 'distributor' | 'viewer';

export type TagTypeEnum = 'product' | 'topic' | 'audience' | 'content_type' | 'medium' | 'language';

export type BackupStatusEnum = 'success' | 'failed' | 'pending';

// ── Row types (what comes back from Supabase) ──────────────────

export interface UserRow {
  id: string;
  full_name: string | null;
  role: UserRoleEnum;
  avatar_url: string | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  tag_type: TagTypeEnum;
  color: string;
  created_at: string;
}

// Row type for the dynamic content_types registry (managed via admin UI after migration 004)
export interface ContentTypeRow {
  id: string;
  key: string;
  label: string;
  color_classes: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: string; // text after migration 004 (was content_type_enum)
  file_url: string | null;
  file_urls: string[]; // additional files (migration 005+)
  backup_url: string | null;
  external_link: string | null;
  thumbnail_url: string | null;
  product_tags: string[];
  topic_tags: string[];
  language_tags: string[];
  audience_tags: AudienceTagEnum[];
  medium_tags: string[];
  status: ContentStatusEnum;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  file_size_bytes: number | null;
  file_type: string | null;
  engagement_data: Record<string, unknown>;
  meta: ContentMeta;
  // Joined fields
  creator?: UserRow;
}

export interface ContentMeta {
  // Blog archiving
  archived_blog?: {
    url: string;
    title: string;
    description: string | null;
    og_image: string | null;
    text_content: string;
    archived_at: string;
  };
  // YouTube metadata
  youtube?: {
    video_id: string;
    embed_html: string;
    thumbnail_url: string;
    author_name: string;
  };
  // Any future metadata
  [key: string]: unknown;
}

export interface ContentView {
  id: string;
  content_id: string;
  viewer_role: UserRoleEnum | null;
  viewed_at: string;
  session_id: string | null;
}

export interface BackupLog {
  id: string;
  content_id: string | null;
  r2_url: string | null;
  b2_url: string | null;
  status: BackupStatusEnum;
  attempted_at: string;
  error_message: string | null;
  // Joined
  content_item?: Pick<ContentItem, 'id' | 'title' | 'content_type'>;
}

// ── Insert types ───────────────────────────────────────────────

export type ContentItemInsert = Omit<
  ContentItem,
  'id' | 'created_at' | 'updated_at' | 'creator'
>;

export type ContentItemUpdate = Partial<
  Omit<ContentItem, 'id' | 'created_at' | 'creator'>
>;

export type TagInsert = Omit<TagRow, 'id' | 'created_at'>;

// ── Public API response type ────────────────────────────────────

export interface PublicContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  file_url: string | null;
  external_link: string | null;
  thumbnail_url: string | null;
  product_tags: string[];
  topic_tags: string[];
  audience_tags: AudienceTagEnum[];
  published_at: string | null;
}

// ── Upload types ───────────────────────────────────────────────

export interface PresignedUploadRequest {
  filename: string;
  content_type_mime: string;
  content_type: string;
}

export interface PresignedUploadResponse {
  upload_url: string;
  file_path: string;
  public_url: string;
}

export interface UploadCompleteRequest {
  title: string;
  description?: string;
  content_type: string;
  file_path?: string;
  file_url?: string;
  file_urls?: string[];
  external_link?: string;
  thumbnail_url?: string;
  product_tags?: string[];
  topic_tags?: string[];
  audience_tags?: AudienceTagEnum[];
  medium_tags?: string[];
  file_size_bytes?: number;
  file_type_mime?: string;
  meta?: ContentMeta;
}

// ── LinkedIn Performance Tracker types (Phase 3) ───────────────

export type LinkedInAccountType = 'personal' | 'company';
export type LinkedInPostFormat = 'text' | 'image' | 'video' | 'carousel' | 'document' | 'poll' | 'other';
export type LinkedInExtractionStatus = 'manual' | 'ai_extracted' | 'ai_partial' | 'pending';
export type LinkedInInsightType = 'pattern' | 'recommendation' | 'anomaly' | 'summary';
export type LinkedInPostStatus = 'draft' | 'published';

export interface LinkedInAccount {
  id: string;
  name: string;
  account_type: LinkedInAccountType;
  profile_url: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LinkedInPost {
  id: string;
  account_id: string;
  post_url: string | null;
  post_date: string;
  post_text: string | null;
  post_format: LinkedInPostFormat;
  status: LinkedInPostStatus;
  topic_tags: string[];
  product_tags: string[];
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  profile_visits: number | null;
  follows_gained: number | null;
  link_clicks: number | null;
  engagement_rate: number | null;
  screenshot_url: string | null;
  extraction_status: LinkedInExtractionStatus;
  extraction_notes: string | null;
  linked_content_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  account?: LinkedInAccount;
  linked_content?: { id: string; title: string; content_type: string; thumbnail_url: string | null };
}

export interface LinkedInAiInsight {
  id: string;
  generated_at: string;
  period_start: string | null;
  period_end: string | null;
  account_id: string | null;
  insight_type: LinkedInInsightType;
  content: string;
  supporting_post_ids: string[];
  thumbs_up: boolean | null;
  run_id: string;
  created_at: string;
}

// Extracted metrics from screenshot via Claude Vision
export interface LinkedInExtractedMetrics {
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  profile_visits: number | null;
  follows_gained: number | null;
  link_clicks: number | null;
  post_date: string | null;
}

// ── Analytics / MIS types (Phase 2) ────────────────────────────

export type MisSourceEnum = 'ga4' | 'search_console' | 'youtube' | 'brevo';
export type MisPeriodTypeEnum = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type MisPullStatusEnum = 'success' | 'failed' | 'partial';

export interface MisSnapshot {
  id: string;
  source: MisSourceEnum;
  property: string;
  period_type: MisPeriodTypeEnum;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  pulled_at: string;
  created_at: string;
}

export interface MisPullLog {
  id: string;
  source: MisSourceEnum;
  period_type: MisPeriodTypeEnum;
  status: MisPullStatusEnum;
  pulled_at: string;
  error_message: string | null;
}

export interface MisHighlight {
  id: string;
  period_start: string;
  period_end: string;
  period_type: MisPeriodTypeEnum;
  highlights: HighlightItem[];
  feedback: Record<string, 'up' | 'down'>;
  created_at: string;
}

export interface HighlightItem {
  id: string;
  source: MisSourceEnum;
  text: string;
  sentiment: 'positive' | 'warning' | 'anomaly';
  /** Actionability tag — WIN | PROBLEM | OPPORTUNITY | WATCH */
  tag?: 'WIN' | 'PROBLEM' | 'OPPORTUNITY' | 'WATCH';
  /** Supporting data points that triggered this insight (optional) */
  data_points?: string[];
}

export interface ContentTarget {
  id: string;
  tag_name: string;
  tag_type: string;
  target_percentage: number;
  set_by: string | null;
  updated_at: string;
}

export interface DashboardConfig {
  id: string;
  user_id: string | null;
  dashboard_name: string;
  config: DashboardConfigData;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardConfigData {
  widgets: WidgetConfig[];
}

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

// GA4 snapshot data shape
export interface GA4SnapshotData {
  organic_sessions: number;
  organic_sessions_prev: number;
  new_users: number;
  returning_users: number;
  bounce_rate: number;
  top_countries: { country: string; sessions: number }[];
  timeline: { date: string; sessions: number }[];
}

// Search Console snapshot data shape
export interface GscSnapshotData {
  clicks: number;
  clicks_prev: number;
  impressions: number;
  impressions_prev: number;
  ctr: number;
  position: number;
  top_queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  top_pages: { page: string; clicks: number; impressions: number }[];
  india?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    top_queries: { query: string; clicks: number }[];
  };
}

// YouTube snapshot data shape
export interface YoutubeSnapshotData {
  views: number;
  views_prev: number;
  watch_time_minutes: number;
  watch_time_prev: number;
  subscribers_gained: number;
  subscribers_lost: number;
  net_subscribers: number;
  top_videos: {
    video_id: string;
    title: string;
    thumbnail: string;
    views: number;
    watch_time_minutes: number;
  }[];
  timeline: { date: string; views: number }[];
}

// Brevo snapshot data shape
export interface BrevoSnapshotData {
  campaigns: {
    id: string;
    name: string;
    send_date: string;
    sent_count: number;
    open_rate: number;
    click_rate: number;
    ctor: number;
    unsubscribe_count: number;
    unsubscribe_rate: number;
  }[];
  avg_open_rate: number;
  avg_click_rate: number;
  avg_ctor: number;
}

// ── CRM / Leads (Phase 4) ───────────────────────────────────────

export type LeadEnrichmentStatus = 'none' | 'pending' | 'done' | 'failed';

export interface ZohoConnection {
  id: string;
  data_center: string;
  access_token: string | null;
  refresh_token: string;
  token_expires_at: string | null;
  zoho_org_id: string | null;
  zoho_user_email: string | null;
  connected_by: string | null;
  connected_at: string;
  last_pull_at: string | null;
  is_active: boolean;
}

export interface Lead {
  id: string;
  zoho_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  title: string | null;
  website: string | null;
  lead_source: string | null;
  industry: string | null;
  lead_status: string | null;
  rating: string | null;
  description: string | null;
  country: string | null;
  is_spam: boolean;
  spam_score: number | null;
  spam_reasons: string[];
  spam_reviewed: boolean;
  quality_score: number | null;
  is_high_value: boolean;
  enrichment_status: LeadEnrichmentStatus;
  enrichment_done_at: string | null;
  raw_data: Record<string, unknown> | null;
  zoho_created_at: string | null;
  zoho_modified_at: string | null;
  pulled_at: string;
  created_at: string;
  updated_at: string;
  // Joined
  enrichment?: LeadEnrichment | null;
}

export interface LeadEnrichment {
  id: string;
  lead_id: string;
  company_summary: string | null;
  likely_use_case: string | null;
  recommended_products: string[];
  talking_points: string[];
  follow_up_suggestion: string | null;
  deal_potential: 'low' | 'medium' | 'high' | null;
  notes: string | null;
  raw_response: Record<string, unknown> | null;
  generated_at: string;
}

// ── Supabase Database generic type ─────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, 'created_at'>;
        Update: Partial<Omit<UserRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      tags_master: {
        Row: TagRow;
        Insert: TagInsert;
        Update: Partial<TagInsert>;
        Relationships: [];
      };
      content_items: {
        Row: ContentItem;
        Insert: ContentItemInsert;
        Update: ContentItemUpdate;
        Relationships: [];
      };
      content_views: {
        Row: ContentView;
        Insert: Omit<ContentView, 'id' | 'viewed_at'>;
        Update: Partial<ContentView>;
        Relationships: [];
      };
      backup_logs: {
        Row: BackupLog;
        Insert: Omit<BackupLog, 'id' | 'attempted_at' | 'content_item'>;
        Update: Partial<Pick<BackupLog, 'status' | 'b2_url' | 'error_message'>>;
        Relationships: [];
      };
      content_types: {
        Row: ContentTypeRow;
        Insert: Omit<ContentTypeRow, 'id' | 'created_at'>;
        Update: Partial<Omit<ContentTypeRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      audience_tag_enum: AudienceTagEnum;
      content_status_enum: ContentStatusEnum;
      user_role_enum: UserRoleEnum;
      tag_type_enum: TagTypeEnum;
      backup_status_enum: BackupStatusEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
