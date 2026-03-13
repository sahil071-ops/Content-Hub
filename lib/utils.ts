import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AudienceTagEnum, ContentStatusEnum } from '@/types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── File size formatting ───────────────────────────────────────

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ── Date formatting ────────────────────────────────────────────

export function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

// ── Content type helpers (static fallbacks; dynamic types are in the content_types DB table) ──

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog / Article',
  catalogue: 'Catalogue',
  ebook: 'eBook',
  emailer: 'Emailer',
  flier: 'Flier',
  graphic: 'Graphic',
  image: 'Photo',
  other: 'Other',
  pdf: 'PDF',
  poster: 'Poster',
  presentation: 'Presentation',
  video: 'YouTube',
  video_file: 'Video File',
  whitepaper: 'Whitepaper',
};

export const CONTENT_TYPE_COLORS: Record<string, string> = {
  blog: 'bg-blue-100 text-blue-700 border-blue-200',
  catalogue: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  ebook: 'bg-pink-100 text-pink-700 border-pink-200',
  emailer: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  flier: 'bg-lime-100 text-lime-700 border-lime-200',
  graphic: 'bg-violet-100 text-violet-700 border-violet-200',
  image: 'bg-green-100 text-green-700 border-green-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
  pdf: 'bg-orange-100 text-orange-700 border-orange-200',
  poster: 'bg-teal-100 text-teal-700 border-teal-200',
  presentation: 'bg-purple-100 text-purple-700 border-purple-200',
  video: 'bg-red-100 text-red-700 border-red-200',
  video_file: 'bg-rose-100 text-rose-700 border-rose-200',
  whitepaper: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

// Sorted alphabetically by label for use in dropdowns and filters (static fallback)
export const SORTED_CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS).sort(
  (a, b) => CONTENT_TYPE_LABELS[a].localeCompare(CONTENT_TYPE_LABELS[b])
);

export const AUDIENCE_LABELS: Record<AudienceTagEnum, string> = {
  internal: 'Internal',
  sales: 'Sales',
  distributor: 'Distributor',
  'end-client': 'End Client',
  public: 'Public',
};

export const STATUS_COLORS: Record<ContentStatusEnum, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archived: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ── R2 file path builder ───────────────────────────────────────

export function buildFilePath(contentType: string, filename: string, uuid: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${contentType}/${year}/${month}/${uuid}-${safeFilename}`;
}

// ── YouTube URL parser ─────────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── Shareable link ─────────────────────────────────────────────

export function getShareableLink(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/library/${id}`;
}

// ── Accepted file types ────────────────────────────────────────

export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/tiff': ['.tif', '.tiff'],
  'image/vnd.adobe.photoshop': ['.psd'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'video/webm': ['.webm'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/html': ['.html'],
};

// Image MIME type prefixes for auto-detection
export const IMAGE_MIME_TYPES = ['image/'];
export const VIDEO_MIME_TYPES = ['video/'];

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

// ── Error message builder ──────────────────────────────────────

export function getStorageErrorMessage(error: unknown, service: 'R2' | 'B2'): string {
  if (!process.env.R2_ACCESS_KEY_ID && service === 'R2') {
    return `${service} credentials are not configured. Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, and R2_BUCKET_NAME in your environment variables.`;
  }
  if (!process.env.B2_ACCESS_KEY_ID && service === 'B2') {
    return `${service} credentials are not configured. Please set B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY, B2_ENDPOINT, and B2_BUCKET_NAME in your environment variables.`;
  }
  if (error instanceof Error) {
    return `${service} error: ${error.message}`;
  }
  return `${service} upload failed. Check your credentials and bucket configuration.`;
}
