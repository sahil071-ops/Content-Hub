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

export type TagTypeEnum = 'product' | 'topic' | 'audience' | 'content_type' | 'medium';

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
