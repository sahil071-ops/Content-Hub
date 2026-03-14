'use client';

import { useState } from 'react';
import { Globe, Loader2, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface ArchivedBlogData {
  url: string;
  title: string;
  description: string | null;
  og_image: string | null;
  text_content: string;
  archived_at: string;
  partial?: boolean;       // true when content couldn't be fetched (e.g. Cloudflare blocked)
  partial_reason?: string; // human-readable explanation
}

interface BlogUrlInputProps {
  onData: (data: ArchivedBlogData | null) => void;
  data: ArchivedBlogData | null;
}

export function BlogUrlInput({ onData, data }: BlogUrlInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/blog-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to archive this URL. The site may block server-side access, or the URL may be invalid.');
        return;
      }

      onData(json);
    } catch (err) {
      setError('Network error while trying to archive the blog. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setUrl('');
    setError(null);
    onData(null);
  }

  if (data) {
    return (
      <div className={`rounded-lg border p-4 space-y-2 ${data.partial ? 'bg-amber-50/50 border-amber-200' : 'bg-muted/30'}`}>
        <div className="flex items-start gap-2">
          {data.partial
            ? <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{data.title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{data.url}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{data.description}</p>
        )}
        {data.partial ? (
          <p className="text-xs text-amber-700 font-medium">
            ⚠ Link saved — site blocked content archiving (Cloudflare). You can still save and manually edit the title/description.
          </p>
        ) : (
          <p className="text-xs text-emerald-600 font-medium">
            ✓ Content archived — saved even if the original is removed
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Blog / Article URL</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="https://example.com/blog/article"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            className="pl-9"
            type="url"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleArchive(); } }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleArchive}
          disabled={!url || loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Archive'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The blog content will be saved to our database so it's preserved even if the original page is taken down.
      </p>
    </div>
  );
}
