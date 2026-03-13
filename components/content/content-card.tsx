'use client';

import Link from 'next/link';
import {
  FileText, Film, Image as ImageIcon, Presentation, Mail, BookOpen,
  FileQuestion, Copy, Check, ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ContentTypeBadge } from '@/components/content/content-type-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn, formatDate, getShareableLink } from '@/lib/utils';
import type { ContentItem, ContentTypeRow } from '@/types/database';

const CONTENT_ICONS: Record<string, React.ElementType> = {
  video: Film,
  video_file: Film,
  pdf: FileText,
  image: ImageIcon,
  presentation: Presentation,
  emailer: Mail,
  blog: BookOpen,
  whitepaper: FileText,
  ebook: BookOpen,
  poster: ImageIcon,
  catalogue: BookOpen,
  flier: FileText,
  graphic: ImageIcon,
  other: FileQuestion,
};

// Content types that use the file_url as a visual preview image
const IMAGE_CONTENT_TYPES = new Set(['image', 'poster', 'graphic', 'flier']);

export type ContentTypesMap = Record<string, Pick<ContentTypeRow, 'label' | 'color_classes'>>;

interface ContentCardProps {
  item: ContentItem;
  view?: 'grid' | 'list';
  contentTypesMap?: ContentTypesMap;
}

export function ContentCard({ item, view = 'grid', contentTypesMap }: ContentCardProps) {
  const [copied, setCopied] = useState(false);
  const Icon = CONTENT_ICONS[item.content_type] ?? FileQuestion;
  const ctData = contentTypesMap?.[item.content_type];

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = getShareableLink(item.id);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  if (view === 'list') {
    return (
      <Link href={`/library/${item.id}`}>
        <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors rounded-lg border bg-card">
          {/* Thumbnail or icon */}
          <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {(item.thumbnail_url || (IMAGE_CONTENT_TYPES.has(item.content_type) && item.file_url)) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail_url || item.file_url!}
                alt={item.title}
                className="object-cover w-full h-full"
              />
            ) : (
              <Icon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <ContentTypeBadge
                contentType={item.content_type}
                label={ctData?.label}
                colorClasses={ctData?.color_classes}
              />
              {item.product_tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <p className="font-medium text-sm truncate">{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
            )}
          </div>

          {/* Meta + actions */}
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{formatDate(item.created_at)}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopyLink}
                    aria-label="Copy link"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy shareable link</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/library/${item.id}`} className="group block">
      <div className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        {/* Thumbnail */}
        <div className="relative aspect-[16/9] bg-muted flex items-center justify-center overflow-hidden">
          {(item.thumbnail_url || (IMAGE_CONTENT_TYPES.has(item.content_type) && item.file_url)) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail_url || item.file_url!}
              alt={item.title}
              className="object-cover w-full h-full group-hover:scale-[1.02] transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
              <Icon className="h-10 w-10" />
              <span className="text-xs">{item.content_type.toUpperCase()}</span>
            </div>
          )}

          {/* Video play overlay */}
          {(item.content_type === 'video' || item.content_type === 'video_file') && item.thumbnail_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
                <Film className="h-5 w-5 text-white ml-0.5" />
              </div>
            </div>
          )}

          {/* External link indicator */}
          {item.external_link && !item.file_url && (
            <div className="absolute top-2 right-2">
              <div className="h-6 w-6 rounded bg-black/50 flex items-center justify-center">
                <ExternalLink className="h-3 w-3 text-white" />
              </div>
            </div>
          )}

          {/* Content type badge overlay */}
          <div className="absolute bottom-2 left-2">
            <ContentTypeBadge
              contentType={item.content_type}
              label={ctData?.label}
              colorClasses={ctData?.color_classes}
            />
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>

          {/* Tags */}
          {item.product_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {item.product_tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {item.product_tags.length > 3 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                  +{item.product_tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -mr-1"
                    onClick={handleCopyLink}
                    aria-label="Copy link"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy shareable link</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </Link>
  );
}
