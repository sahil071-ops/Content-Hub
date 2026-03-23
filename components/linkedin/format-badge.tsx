import { Badge } from '@/components/ui/badge';
import type { LinkedInPostFormat } from '@/types/database';

const FORMAT_STYLES: Record<LinkedInPostFormat, string> = {
  text:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  image:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  video:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  carousel:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  document:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  poll:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  other:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const FORMAT_LABELS: Record<LinkedInPostFormat, string> = {
  text:      'Text',
  image:     'Photo',
  video:     'Video',
  carousel:  'Carousel',
  document:  'Document',
  poll:      'Poll',
  other:     'Other',
};

interface FormatBadgeProps {
  format: LinkedInPostFormat;
}

export function FormatBadge({ format }: FormatBadgeProps) {
  return (
    <Badge className={`text-xs font-normal ${FORMAT_STYLES[format] || FORMAT_STYLES.other}`}>
      {FORMAT_LABELS[format] ?? format}
    </Badge>
  );
}
