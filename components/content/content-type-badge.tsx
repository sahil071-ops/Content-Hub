import { cn, CONTENT_TYPE_LABELS, CONTENT_TYPE_COLORS } from '@/lib/utils';

interface ContentTypeBadgeProps {
  contentType: string;
  /** Override label (e.g. from the dynamic content_types table) */
  label?: string;
  /** Override Tailwind color classes (e.g. from the dynamic content_types table) */
  colorClasses?: string;
  className?: string;
}

export function ContentTypeBadge({ contentType, label, colorClasses, className }: ContentTypeBadgeProps) {
  const displayLabel = label ?? CONTENT_TYPE_LABELS[contentType] ?? contentType;
  const displayColor = colorClasses ?? CONTENT_TYPE_COLORS[contentType] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        displayColor,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
