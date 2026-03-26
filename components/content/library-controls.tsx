'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── View Toggle ────────────────────────────────────────────────────────────

interface ViewToggleProps {
  current: 'grid' | 'list';
  searchParamsStr: string;
}

export function ViewToggle({ current, searchParamsStr }: ViewToggleProps) {
  // On mount: restore persisted view if none in URL
  useEffect(() => {
    const params = new URLSearchParams(searchParamsStr);
    if (!params.has('view')) {
      try {
        const stored = sessionStorage.getItem('library-view');
        if (stored === 'list') {
          params.set('view', 'list');
          window.history.replaceState(null, '', `/library?${params.toString()}`);
        }
      } catch { /* sessionStorage may be unavailable */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildUrl(view: 'grid' | 'list') {
    const params = new URLSearchParams(searchParamsStr);
    if (view === 'grid') params.delete('view');
    else params.set('view', 'list');
    const qs = params.toString();
    return `/library${qs ? `?${qs}` : ''}`;
  }

  function saveView(view: 'grid' | 'list') {
    try { sessionStorage.setItem('library-view', view); } catch { /* ok */ }
  }

  return (
    <div className="flex rounded-md border overflow-hidden">
      <Link
        href={buildUrl('grid')}
        onClick={() => saveView('grid')}
        className={`flex items-center px-3 py-2 transition-colors ${
          current === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Link>
      <Link
        href={buildUrl('list')}
        onClick={() => saveView('list')}
        className={`flex items-center px-3 py-2 transition-colors ${
          current === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
        aria-label="List view"
      >
        <List className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Sort Selector ──────────────────────────────────────────────────────────

interface SortSelectorProps {
  current: string;
  searchParamsStr: string;
}

export function SortSelector({ current, searchParamsStr }: SortSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParamsStr);
    if (value === 'newest') params.delete('sort');
    else params.set('sort', value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleSort}>
      <SelectTrigger className="w-40 h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest first</SelectItem>
        <SelectItem value="oldest">Oldest first</SelectItem>
        <SelectItem value="updated">Recently updated</SelectItem>
      </SelectContent>
    </Select>
  );
}
