'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  tag_type: string;
  color: string;
}

interface TagInputProps {
  /** Tag types to query — e.g. ['topic'] or ['product'] */
  types: string[];
  /** Currently selected tag names */
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'default';
}

export function TagInput({
  types,
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  size = 'default',
}: TagInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [placeholderExamples, setPlaceholderExamples] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load placeholder examples from the DB on mount
  useEffect(() => {
    const params = new URLSearchParams();
    types.forEach(t => params.append('type', t));
    fetch(`/api/tags?${params}`)
      .then(r => r.json())
      .then(({ tags }: { tags: Tag[] }) => {
        if (tags?.length > 0) {
          setPlaceholderExamples(
            tags.slice(0, 3).map(t => t.name).join(', ')
          );
        }
      })
      .catch(() => {});
  }, [types.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch suggestions on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      // Show all tags when input is focused with empty query
      if (open) {
        setLoading(true);
        const params = new URLSearchParams();
        types.forEach(t => params.append('type', t));
        fetch(`/api/tags?${params}`)
          .then(r => r.json())
          .then(({ tags }: { tags: Tag[] }) => {
            setSuggestions((tags ?? []).filter(t => !value.includes(t.name)));
          })
          .catch(() => setSuggestions([]))
          .finally(() => setLoading(false));
      }
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query });
      types.forEach(t => params.append('type', t));
      fetch(`/api/tags?${params}`)
        .then(r => r.json())
        .then(({ tags }: { tags: Tag[] }) => {
          setSuggestions((tags ?? []).filter(t => !value.includes(t.name)));
          setOpen(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setQuery('');
    setSuggestions(prev => prev.filter(t => t.name !== trimmed));
    inputRef.current?.focus();
  }

  function removeTag(name: string) {
    onChange(value.filter(t => t !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && query.trim()) {
      e.preventDefault();
      // Only add if it matches a suggestion or allow free entry
      addTag(query);
      setOpen(false);
    }
    if (e.key === 'Backspace' && !query && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const isSmall = size === 'sm';

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          isSmall ? 'min-h-8 py-1' : 'min-h-10'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className={cn('gap-1 pr-1', isSmall ? 'text-[10px] h-5' : 'text-xs h-6')}
          >
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeTag(tag); }}
              className="rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className={isSmall ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? (placeholder ?? placeholderExamples ?? 'Type to search…') : ''}
          className={cn(
            'flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground',
            isSmall ? 'text-xs h-5' : 'text-sm',
            inputClassName
          )}
        />
      </div>

      {open && (suggestions.length > 0 || loading) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md"
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
          )}
          {!loading && suggestions.slice(0, 10).map(tag => (
            <button
              key={tag.id}
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              onMouseDown={e => { e.preventDefault(); addTag(tag.name); setOpen(false); }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.color || '#3D3D3D' }}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
