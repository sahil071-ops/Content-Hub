import { cn, CONTENT_TYPE_LABELS, CONTENT_TYPE_COLORS } from '@/lib/utils';
import type { ContentTypeEnum } from '@/types/database';

interface ContentTypeBadgeProps {
  contentType: ContentTypeEnum;
  className?: string;
}

export function ContentTypeBadge({ contentType, className }: ContentTypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        CONTENT_TYPE_COLORS[contentType],
        className
      )}
    >
      {CONTENT_TYPE_LABELS[contentType]}
    </span>
  );
}
