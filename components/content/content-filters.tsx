'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CONTENT_TYPE_LABELS, AUDIENCE_LABELS, SORTED_CONTENT_TYPES } from '@/lib/utils';
import type { AudienceTagEnum, UserRoleEnum, TagRow, ContentTypeRow } from '@/types/database';

const AUDIENCE_TYPES = Object.keys(AUDIENCE_LABELS) as AudienceTagEnum[];
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

interface ContentFiltersProps {
  productTags: TagRow[];
  topicTags: TagRow[];
  userRole: UserRoleEnum;
  contentTypes?: ContentTypeRow[];
}

export function ContentFilters({ productTags, topicTags, userRole, contentTypes }: ContentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Use dynamic content types from DB if available, fall back to static list
  const typeList: Array<{ key: string; label: string }> = contentTypes && contentTypes.length > 0
    ? contentTypes.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => ({ key: t.key, label: t.label }))
    : SORTED_CONTENT_TYPES.map((k) => ({ key: k, label: CONTENT_TYPE_LABELS[k] ?? k }));

  const updateFilter = useCallback((key: string, value: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.getAll(key);

    if (checked) {
      if (!current.includes(value)) {
        params.append(key, value);
      }
    } else {
      const updated = current.filter((v) => v !== value);
      params.delete(key);
      updated.forEach((v) => params.append(key, v));
    }

    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    ['type', 'product', 'topic', 'audience', 'status'].forEach((k) => params.delete(k));
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  const isChecked = (key: string, value: string) => searchParams.getAll(key).includes(value);

  const hasFilters = ['type', 'product', 'topic', 'audience', 'status']
    .some((k) => searchParams.has(k));

  const canSeeStatus = ['admin', 'marketing'].includes(userRole);

  return (
    <div className="w-56 shrink-0 hidden lg:block">
      <div className="sticky top-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearAllFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="space-y-5 pr-2">
            {/* Content Type */}
            <FilterSection title="Content Type">
              {typeList.map(({ key, label }) => (
                <FilterCheckbox
                  key={key}
                  id={`type-${key}`}
                  label={label}
                  checked={isChecked('type', key)}
                  onChange={(checked) => updateFilter('type', key, checked)}
                />
              ))}
            </FilterSection>

            {/* Product Tags */}
            {productTags.length > 0 && (
              <FilterSection title="Product">
                {productTags.map((tag) => (
                  <FilterCheckbox
                    key={tag.id}
                    id={`product-${tag.id}`}
                    label={tag.name}
                    checked={isChecked('product', tag.name)}
                    onChange={(checked) => updateFilter('product', tag.name, checked)}
                    color={tag.color}
                  />
                ))}
              </FilterSection>
            )}

            {/* Topic Tags */}
            {topicTags.length > 0 && (
              <FilterSection title="Topic">
                {topicTags.map((tag) => (
                  <FilterCheckbox
                    key={tag.id}
                    id={`topic-${tag.id}`}
                    label={tag.name}
                    checked={isChecked('topic', tag.name)}
                    onChange={(checked) => updateFilter('topic', tag.name, checked)}
                    color={tag.color}
                  />
                ))}
              </FilterSection>
            )}

            {/* Audience */}
            {canSeeStatus && (
              <FilterSection title="Audience">
                {AUDIENCE_TYPES.map((audience) => (
                  <FilterCheckbox
                    key={audience}
                    id={`audience-${audience}`}
                    label={AUDIENCE_LABELS[audience]}
                    checked={isChecked('audience', audience)}
                    onChange={(checked) => updateFilter('audience', audience, checked)}
                  />
                ))}
              </FilterSection>
            )}

            {/* Status — admin/marketing only */}
            {canSeeStatus && (
              <FilterSection title="Status">
                {STATUS_OPTIONS.map((status) => (
                  <FilterCheckbox
                    key={status.value}
                    id={`status-${status.value}`}
                    label={status.label}
                    checked={isChecked('status', status.value)}
                    onChange={(checked) => updateFilter('status', status.value, checked)}
                  />
                ))}
              </FilterSection>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  id, label, checked, onChange, color,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
        {color && (
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        {label}
      </Label>
    </div>
  );
}
