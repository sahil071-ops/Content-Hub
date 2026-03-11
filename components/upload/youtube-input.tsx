'use client';

import { useState } from 'react';
import { Youtube, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { extractYouTubeId } from '@/lib/utils';

interface YouTubeData {
  video_id: string;
  title: string;
  thumbnail_url: string;
  author_name: string;
  embed_html: string;
}

interface YouTubeInputProps {
  onData: (data: YouTubeData | null) => void;
  data: YouTubeData | null;
}

export function YouTubeInput({ onData, data }: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      setError('Could not extract a valid YouTube video ID from this URL. Please check the link and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(url)}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to fetch video details. Please check the URL and try again.');
        return;
      }

      onData(json);
    } catch (err) {
      setError('Network error while fetching video details. Please try again.');
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
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex gap-3 items-start">
          <div className="relative shrink-0 w-24 h-14 rounded overflow-hidden">
            <Image
              src={data.thumbnail_url}
              alt={data.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                <Youtube className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{data.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{data.author_name}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>YouTube URL</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            className="pl-9"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetch(); } }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleFetch}
          disabled={!url || loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Paste a YouTube URL and click Fetch to auto-import the title and thumbnail.
      </p>
    </div>
  );
}
