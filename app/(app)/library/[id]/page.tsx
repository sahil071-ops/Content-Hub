import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Download, Copy, Edit, Calendar, User, Tag,
  Globe, FileText, ExternalLink, Users, Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ContentTypeBadge } from '@/components/content/content-type-badge';
import { ContentGrid } from '@/components/content/content-grid';
import { PdfViewer } from '@/components/content/pdf-viewer';
import { CopyLinkButton } from '@/components/content/copy-link-button';
import {
  formatDate, formatFileSize, formatDateTime,
  AUDIENCE_LABELS, STATUS_COLORS,
} from '@/lib/utils';
import type { ContentItem, UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface ContentDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: ContentDetailPageProps): Promise<Metadata> {
  const supabase = createClient();
  const { data } = await supabase.from('content_items').select('title, description').eq('id', params.id).single() as { data: { title: string; description: string | null } | null; error: unknown };
  return {
    title: data?.title || 'Content',
    description: data?.description || undefined,
  };
}

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  const userRole = ((userProfile as any)?.role || 'viewer') as UserRoleEnum;
  const canEdit = ['admin', 'marketing'].includes(userRole);

  const { data: item, error } = await supabase
    .from('content_items')
    .select('*, creator:users!created_by(full_name, avatar_url)')
    .eq('id', params.id)
    .single();

  if (!item || error) notFound();

  // Log view (fire and forget)
  supabase.from('content_views').insert({
    content_id: params.id,
    viewer_role: userRole,
    session_id: null,
  }).then(() => {});

  // Related content (same product tags)
  let related: ContentItem[] = [];
  if (item.product_tags.length > 0) {
    const { data: relatedData } = await supabase
      .from('content_items')
      .select('*')
      .overlaps('product_tags', item.product_tags)
      .neq('id', params.id)
      .eq('status', 'published')
      .limit(4);
    related = relatedData || [];
  }

  // Content types that are always PDF documents
  const PDF_TYPES = new Set(['pdf', 'ebook', 'whitepaper', 'catalogue', 'flier', 'presentation', 'emailer']);
  // Content types that are always image files
  const IMAGE_TYPES = new Set(['image', 'graphic', 'poster']);

  // Also detect from the actual file URL extension (most reliable for mixed types like 'other')
  const fileExt = item.file_url
    ? item.file_url.toLowerCase().split('?')[0].split('.').pop() ?? ''
    : '';
  const urlIsPdf   = fileExt === 'pdf';
  const urlIsImage = /^(jpg|jpeg|png|gif|webp|svg|avif)$/.test(fileExt);
  const urlIsVideo = /^(mp4|webm|mov|avi|mkv)$/.test(fileExt);

  const isVideo     = item.content_type === 'video' || item.content_type === 'video_file' || urlIsVideo;
  const isPdf       = !!item.file_url && (urlIsPdf   || PDF_TYPES.has(item.content_type));
  const isImage     = !!item.file_url && (urlIsImage || IMAGE_TYPES.has(item.content_type));
  const youtubeData = item.meta?.youtube as any;
  const archivedBlog = item.meta?.archived_blog as any;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/library">
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Link>
      </Button>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Left: Preview ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Preview area */}
          <div className="rounded-lg border overflow-hidden bg-card">
            {isVideo && youtubeData?.video_id ? (
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeData.video_id}`}
                  title={item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : isVideo && item.file_url ? (
              <div className="aspect-video bg-black flex items-center justify-center">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={item.file_url}
                  controls
                  className="w-full h-full max-h-[600px]"
                />
              </div>
            ) : isPdf && item.file_url ? (
              <div className="h-[600px]">
                <PdfViewer url={item.file_url} />
              </div>
            ) : isImage && item.file_url ? (
              <div className="relative aspect-video flex items-center justify-center bg-muted/30 p-4">
                <Image
                  src={item.file_url}
                  alt={item.title}
                  width={800}
                  height={450}
                  className="object-contain max-h-full rounded"
                />
              </div>
            ) : item.thumbnail_url ? (
              <div className="relative aspect-video">
                <Image src={item.thumbnail_url} alt={item.title} fill className="object-cover" />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center bg-muted text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No preview available</p>
                  {item.file_url && (
                    <p className="text-xs mt-1 opacity-60">Download to view</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Additional image files gallery */}
          {(item as any).file_urls?.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Additional Files ({(item as any).file_urls.length})
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(item as any).file_urls.map((url: string, i: number) => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
                  return isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                      <img src={url} alt={`File ${i + 2}`} className="w-full aspect-square object-cover" />
                    </a>
                  ) : (
                    <a key={url} href={url} download className="flex items-center gap-2 p-3 rounded-lg border text-sm hover:bg-muted/50 transition-colors">
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{url.split('/').pop()?.replace(/^[^-]+-/, '') || `File ${i + 2}`}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Archived blog content */}
          {archivedBlog?.text_content && (
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="shrink-0">Archived from:</span>
                  <a href={archivedBlog.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {archivedBlog.url}
                  </a>
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
                Images are not archived. Use &ldquo;Open Original&rdquo; to view the full article with images.
              </p>
              <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                {archivedBlog.text_content}
              </div>
            </div>
          )}

          {/* Related content */}
          {related.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Related Content
              </h2>
              <ContentGrid items={related} view="grid" />
            </div>
          )}
        </div>

        {/* ── Right: Metadata ───────────────────────────────────── */}
        <div className="space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <ContentTypeBadge contentType={item.content_type} />
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || ''}`}>
                {item.status}
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight">{item.title}</h1>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.description}</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <CopyLinkButton id={item.id} />
            {item.file_url && (
              <Button variant="outline" asChild className="w-full">
                <a href={item.file_url} download>
                  <Download className="h-4 w-4" />
                  Download File
                </a>
              </Button>
            )}
            {/* Additional files */}
            {(item as any).file_urls?.length > 0 && (item as any).file_urls.map((url: string, i: number) => (
              <Button key={url} variant="outline" asChild className="w-full">
                <a href={url} download>
                  <Download className="h-4 w-4" />
                  Download File {i + 2}
                </a>
              </Button>
            ))}
            {item.external_link && (
              <Button variant="outline" asChild className="w-full">
                <a href={item.external_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Original
                </a>
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" asChild className="w-full">
                <Link href={`/upload?edit=${item.id}`}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
          </div>

          <Separator />

          {/* Metadata details */}
          <div className="space-y-3 text-sm">
            <MetaRow icon={Calendar} label="Published">
              {item.published_at ? formatDate(item.published_at) : 'Not published'}
            </MetaRow>
            <MetaRow icon={Calendar} label="Created">
              {formatDate(item.created_at)}
            </MetaRow>
            {(item as any).creator?.full_name && (
              <MetaRow icon={User} label="Uploaded by">
                {(item as any).creator.full_name}
              </MetaRow>
            )}
            {item.file_size_bytes && (
              <MetaRow icon={FileText} label="File size">
                {formatFileSize(item.file_size_bytes)}
              </MetaRow>
            )}
          </div>

          {/* Product tags */}
          {item.product_tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Products</p>
              <div className="flex flex-wrap gap-1">
                {item.product_tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Topic tags */}
          {item.topic_tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topics</p>
              <div className="flex flex-wrap gap-1">
                {item.topic_tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Audience */}
          {item.audience_tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audience</p>
              <div className="flex flex-wrap gap-1">
                {item.audience_tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs capitalize">
                    {AUDIENCE_LABELS[tag as keyof typeof AUDIENCE_LABELS] || tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-muted-foreground text-xs">{label}</span>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}
