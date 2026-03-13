'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Loader2, AlertCircle, CheckCircle2, UploadCloud, X, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { extractYouTubeId } from '@/lib/utils';

// ── CSV Parser ─────────────────────────────────────────────────────
// Parse a CSV string and return all cells that look like YouTube URLs
function extractYouTubeUrlsFromCsv(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Split by newlines
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // Simple CSV split: split by comma, strip quotes
    const cells = line.split(',').map((c) => c.replace(/^["'\s]+|["'\s]+$/g, '').trim());
    for (const cell of cells) {
      // Check if this cell looks like a YouTube URL
      if (
        (cell.includes('youtube.com') || cell.includes('youtu.be')) &&
        extractYouTubeId(cell)
      ) {
        if (!seen.has(cell)) {
          seen.add(cell);
          urls.push(cell);
        }
      }
    }
  }
  return urls;
}

interface VideoItem {
  url: string;
  videoId: string;
  selected: boolean;
  // Fetched metadata
  metaStatus: 'idle' | 'fetching' | 'fetched' | 'error';
  title?: string;
  description?: string;
  author_name?: string;
  thumbnail_url?: string;
  embed_html?: string;
  errorMsg?: string;
  // Import status
  importStatus: 'idle' | 'saving' | 'done' | 'error';
  importError?: string;
}

export function YouTubeCsvImport() {
  const router = useRouter();
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const abortRef = useRef(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setParseError(null);
    setVideoItems([]);
    setImportDone(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const urls = extractYouTubeUrlsFromCsv(text);
      if (urls.length === 0) {
        setParseError('No YouTube URLs found in this file. Make sure the file contains YouTube links (youtube.com or youtu.be).');
        return;
      }
      const items: VideoItem[] = urls.map((url) => ({
        url,
        videoId: extractYouTubeId(url)!,
        selected: true,
        metaStatus: 'idle',
        importStatus: 'idle',
      }));
      setVideoItems(items);
    };
    reader.onerror = () => setParseError('Failed to read file.');
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: fetchingMeta || importing,
  });

  async function fetchAllMetadata() {
    const toFetch = videoItems.filter((v) => v.metaStatus === 'idle');
    if (toFetch.length === 0) return;
    setFetchingMeta(true);

    // Fetch in batches of 3 to avoid rate limiting
    const BATCH = 3;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item) => {
        setVideoItems((prev) => prev.map((v) => v.url === item.url ? { ...v, metaStatus: 'fetching' } : v));
        try {
          const res = await fetch(`/api/youtube?url=${encodeURIComponent(item.url)}`);
          const json = await res.json();
          if (!res.ok) {
            setVideoItems((prev) => prev.map((v) => v.url === item.url
              ? { ...v, metaStatus: 'error', errorMsg: json.error || 'Failed to fetch' }
              : v));
          } else {
            setVideoItems((prev) => prev.map((v) => v.url === item.url
              ? {
                  ...v,
                  metaStatus: 'fetched',
                  title: json.title,
                  description: json.description,
                  author_name: json.author_name,
                  thumbnail_url: json.thumbnail_url,
                  embed_html: json.embed_html,
                }
              : v));
          }
        } catch {
          setVideoItems((prev) => prev.map((v) => v.url === item.url
            ? { ...v, metaStatus: 'error', errorMsg: 'Network error' }
            : v));
        }
      }));
    }
    setFetchingMeta(false);
  }

  function toggleAll(selected: boolean) {
    setVideoItems((prev) => prev.map((v) => ({ ...v, selected })));
  }

  async function handleImport() {
    const selected = videoItems.filter((v) => v.selected && v.metaStatus === 'fetched' && v.importStatus === 'idle');
    if (selected.length === 0) return;
    setImporting(true);
    abortRef.current = false;

    for (const item of selected) {
      if (abortRef.current) break;
      setVideoItems((prev) => prev.map((v) => v.url === item.url ? { ...v, importStatus: 'saving' } : v));

      try {
        const res = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title || `YouTube: ${item.videoId}`,
            description: item.description || null,
            content_type: 'video',
            external_link: item.url,
            thumbnail_url: item.thumbnail_url || null,
            product_tags: [],
            topic_tags: [],
            audience_tags: [],
            medium_tags: [],
            status: 'draft',
            meta: {
              youtube: {
                video_id: item.videoId,
                embed_html: item.embed_html || '',
                thumbnail_url: item.thumbnail_url || '',
                author_name: item.author_name || '',
                title: item.title || '',
              },
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Save failed');
        setVideoItems((prev) => prev.map((v) => v.url === item.url ? { ...v, importStatus: 'done' } : v));
      } catch (err) {
        setVideoItems((prev) => prev.map((v) => v.url === item.url
          ? { ...v, importStatus: 'error', importError: err instanceof Error ? err.message : 'Failed' }
          : v));
      }
    }

    setImporting(false);
    setImportDone(true);
    toast.success('Import complete', { description: 'YouTube videos saved as drafts.' });
  }

  const fetchedCount = videoItems.filter((v) => v.metaStatus === 'fetched').length;
  const selectedCount = videoItems.filter((v) => v.selected && v.metaStatus === 'fetched' && v.importStatus === 'idle').length;
  const doneCount = videoItems.filter((v) => v.importStatus === 'done').length;
  const metaProgress = videoItems.length > 0
    ? videoItems.filter((v) => v.metaStatus === 'fetched' || v.metaStatus === 'error').length / videoItems.length * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* File drop */}
      {videoItems.length === 0 ? (
        <div className="space-y-3">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-red-400 bg-red-50' : 'border-muted-foreground/25 hover:border-red-300 hover:bg-red-50/30'
            }`}
          >
            <input {...getInputProps()} />
            <Youtube className={`h-10 w-10 mb-3 ${isDragActive ? 'text-red-500' : 'text-muted-foreground/50'}`} />
            {isDragActive ? (
              <p className="text-sm font-medium text-red-600">Drop your CSV here</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drop your CSV file here, or <span className="text-red-500">browse</span></p>
                <p className="text-xs text-muted-foreground mt-1">CSV file with YouTube links · One URL per row (or mixed columns)</p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{videoItems.length} YouTube URLs found</p>
              {fetchedCount > 0 && (
                <Badge variant="outline" className="text-xs">{fetchedCount} metadata loaded</Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setVideoItems([]); setParseError(null); setImportDone(false); }}
              disabled={fetchingMeta || importing}
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          {/* Fetch metadata step */}
          {videoItems.some((v) => v.metaStatus === 'idle') && !fetchingMeta && (
            <Button
              type="button"
              onClick={fetchAllMetadata}
              disabled={fetchingMeta}
              className="w-full bg-[#2323A3] hover:bg-[#2323A3]/90"
            >
              Load Titles & Thumbnails for All {videoItems.length} Videos
            </Button>
          )}

          {/* Meta fetch progress */}
          {fetchingMeta && (
            <div className="space-y-1">
              <Progress value={metaProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Loading video information…</p>
            </div>
          )}

          {/* Video list */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(true)}>Select all</Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(false)}>Deselect all</Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {videoItems.map((item) => (
              <div
                key={item.url}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  item.importStatus === 'done' ? 'bg-emerald-50/50 border-emerald-200' :
                  item.importStatus === 'error' ? 'bg-red-50/50 border-red-200' : 'bg-card'
                }`}
              >
                {/* Checkbox / status icon */}
                {item.importStatus === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : item.importStatus === 'saving' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
                ) : item.importStatus === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                ) : (
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => setVideoItems((prev) => prev.map((v) => v.url === item.url ? { ...v, selected: !v.selected } : v))}
                    disabled={item.metaStatus !== 'fetched' || importing}
                    className="shrink-0"
                  />
                )}

                {/* Thumbnail */}
                {item.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail_url}
                    alt={item.title || item.videoId}
                    className="h-12 w-20 object-cover rounded shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-12 w-20 rounded bg-muted flex items-center justify-center shrink-0">
                    {item.metaStatus === 'fetching' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Youtube className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {item.metaStatus === 'fetched' ? (
                    <>
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.author_name}</p>
                    </>
                  ) : item.metaStatus === 'error' ? (
                    <>
                      <p className="text-xs font-mono text-muted-foreground truncate">youtu.be/{item.videoId}</p>
                      <p className="text-xs text-destructive">{item.errorMsg}</p>
                    </>
                  ) : (
                    <p className="text-xs font-mono text-muted-foreground truncate">youtu.be/{item.videoId}</p>
                  )}
                  {item.importStatus === 'error' && (
                    <p className="text-xs text-destructive">{item.importError}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Import button */}
          {!importDone ? (
            <div className="flex justify-end gap-2 pt-1">
              {importing && (
                <Button type="button" variant="outline" onClick={() => { abortRef.current = true; }}>
                  Stop
                </Button>
              )}
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || importing || fetchedCount === 0}
                className="bg-[#2323A3] hover:bg-[#2323A3]/90"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Import {selectedCount} Video{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-emerald-600 font-medium">{doneCount} video{doneCount !== 1 ? 's' : ''} imported as drafts</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setVideoItems([]); setImportDone(false); }}>
                  Import More
                </Button>
                <Button type="button" onClick={() => router.push('/library?type=video')} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
                  View in Library
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
