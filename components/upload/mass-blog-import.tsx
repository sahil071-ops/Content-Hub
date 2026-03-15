'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, AlertCircle, CheckCircle2, List, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { TagRow } from '@/types/database';

interface UrlItem {
  url: string;
  selected: boolean;
  status: 'idle' | 'importing' | 'done' | 'error';
  title?: string;
  errorMsg?: string;
}

interface MassBlogImportProps {
  productTags: TagRow[];
  topicTags: TagRow[];
}

export function MassBlogImport({ productTags, topicTags }: MassBlogImportProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'auto' | 'manual'>('auto');
  const [inputUrl, setInputUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlSource, setCrawlSource] = useState<string | null>(null);
  const [urlItems, setUrlItems] = useState<UrlItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const abortRef = useRef(false);

  /** Extract all http(s) URLs from any text (CSV, TSV, plain list, etc.) */
  function extractUrlsFromText(text: string): string[] {
    const seen = new Set<string>();
    const urls: string[] = [];
    // Match any http/https URL — works for CSV cells, tab-separated, plain lines
    const re = /https?:\/\/[^\s,"'<>]+/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const u = m[0].replace(/[.,;)]+$/, ''); // strip trailing punctuation
      if (!seen.has(u)) { seen.add(u); urls.push(u); }
    }
    return urls;
  }

  function loadUrls(urls: string[], source: string) {
    if (urls.length === 0) { setCrawlError('No valid URLs found.'); return; }
    setCrawlError(null);
    setCrawlSource(source);
    setImportDone(false);
    setUrlItems(urls.map((url) => ({ url, selected: true, status: 'idle' })));
  }

  function handleManualLoad() {
    loadUrls(extractUrlsFromText(manualText), 'manual');
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      loadUrls(extractUrlsFromText(text), 'csv');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleCrawl() {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    setCrawling(true);
    setCrawlError(null);
    setUrlItems([]);
    setImportDone(false);

    try {
      const res = await fetch('/api/blog-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCrawlError(json.error || 'Failed to crawl this website.');
        return;
      }
      if (json.total === 0) {
        setCrawlError(json.error || 'No blog posts found. Try entering the URL of your blog page directly (e.g. https://example.com/blog).');
        return;
      }
      setCrawlSource(json.source);
      setUrlItems((json.urls as string[]).map((url) => ({ url, selected: true, status: 'idle' })));
    } catch {
      setCrawlError('Network error. Please try again.');
    } finally {
      setCrawling(false);
    }
  }

  function toggleAll(selected: boolean) {
    setUrlItems((prev) => prev.map((item) => ({ ...item, selected })));
  }

  function toggleItem(url: string) {
    setUrlItems((prev) => prev.map((item) => item.url === url ? { ...item, selected: !item.selected } : item));
  }

  function shortUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + (u.search || '');
    } catch {
      return url;
    }
  }

  async function handleImport() {
    const selected = urlItems.filter((i) => i.selected && i.status === 'idle');
    if (selected.length === 0) return;

    setImporting(true);
    abortRef.current = false;

    for (const item of selected) {
      if (abortRef.current) break;

      // Mark as importing
      setUrlItems((prev) => prev.map((i) => i.url === item.url ? { ...i, status: 'importing' } : i));

      try {
        // Archive the blog
        const archiveRes = await fetch('/api/blog-archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url }),
        });
        const archiveJson = await archiveRes.json();

        if (!archiveRes.ok) {
          setUrlItems((prev) => prev.map((i) => i.url === item.url
            ? { ...i, status: 'error', errorMsg: archiveJson.error || 'Archive failed' }
            : i));
          continue;
        }

        // Save to database
        const completeRes = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: archiveJson.title || item.url,
            description: archiveJson.description || null,
            content_type: 'blog',
            external_link: item.url,
            thumbnail_url: archiveJson.og_image || null,
            product_tags: [],
            topic_tags: [],
            audience_tags: [],
            medium_tags: [],
            status: 'draft',
            meta: { archived_blog: archiveJson },
          }),
        });
        const completeJson = await completeRes.json();

        if (!completeRes.ok) {
          setUrlItems((prev) => prev.map((i) => i.url === item.url
            ? { ...i, status: 'error', errorMsg: completeJson.error || 'Save failed' }
            : i));
          continue;
        }

        setUrlItems((prev) => prev.map((i) => i.url === item.url
          ? { ...i, status: 'done', title: archiveJson.title }
          : i));
      } catch (err) {
        setUrlItems((prev) => prev.map((i) => i.url === item.url
          ? { ...i, status: 'error', errorMsg: err instanceof Error ? err.message : 'Failed' }
          : i));
      }
    }

    setImporting(false);
    setImportDone(true);

    const doneCount = urlItems.filter((i) => i.status === 'done').length + selected.filter((_, idx) => {
      // count newly done ones
      return true;
    }).length;

    toast.success('Import complete', {
      description: 'Blog posts saved as drafts. Add tags and publish from the library.',
    });
  }

  const selectedCount = urlItems.filter((i) => i.selected && i.status === 'idle').length;
  const doneCount = urlItems.filter((i) => i.status === 'done').length;
  const errorCount = urlItems.filter((i) => i.status === 'error').length;
  const progressPct = urlItems.filter((i) => i.status !== 'idle').length / Math.max(urlItems.length, 1) * 100;

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => { setTab('auto'); setCrawlError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'auto' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="h-3.5 w-3.5" /> Auto-detect
        </button>
        <button
          type="button"
          onClick={() => { setTab('manual'); setCrawlError(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <List className="h-3.5 w-3.5" /> Paste URLs
        </button>
      </div>

      {tab === 'auto' ? (
        /* Auto-detect input */
        <div className="space-y-2">
          <Label>Website or Blog URL</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="https://example.com/blog"
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setCrawlError(null); }}
                className="pl-9"
                type="url"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCrawl(); } }}
                disabled={crawling || importing}
              />
            </div>
            <Button
              type="button"
              onClick={handleCrawl}
              disabled={!inputUrl.trim() || crawling || importing}
              className="bg-[#2323A3] hover:bg-[#2323A3]/90 shrink-0"
            >
              {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find Posts'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your blog URL — we scan the sitemap, RSS feed, and page links. Or paste a sitemap XML URL directly (e.g. <span className="font-mono">https://example.com/sitemap.xml</span>).
          </p>
          {crawlError && (
            <div className="flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{crawlError}</span>
            </div>
          )}
        </div>
      ) : (
        /* Manual paste / CSV upload */
        <div className="space-y-3">
          {/* CSV upload */}
          <div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleCsvUpload}
              disabled={importing}
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors py-4 text-sm text-muted-foreground"
            >
              <Upload className="h-4 w-4" />
              {csvFileName
                ? <span className="text-foreground font-medium">{csvFileName}</span>
                : <span>Upload CSV / spreadsheet with blog URLs</span>
              }
            </button>
            <p className="text-xs text-muted-foreground mt-1">
              Any CSV or spreadsheet exported file — URLs are auto-detected from any column.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or paste</span>
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder={"https://example.com/blog/post-1\nhttps://example.com/blog/post-2\nhttps://example.com/blog/post-3"}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              disabled={importing}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">One URL per line.</p>
              <Button
                type="button"
                onClick={handleManualLoad}
                disabled={!manualText.trim() || importing}
                className="bg-[#2323A3] hover:bg-[#2323A3]/90 shrink-0"
              >
                Load URLs
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {urlItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{urlItems.length} posts found</p>
              {crawlSource && (
                <Badge variant="outline" className="text-xs">via {crawlSource}</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(true)}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAll(false)}>
                Deselect all
              </Button>
            </div>
          </div>

          {/* URL list */}
          <div className="rounded-lg border divide-y max-h-80 overflow-y-auto">
            {urlItems.map((item) => (
              <div
                key={item.url}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                  item.status === 'done' ? 'bg-emerald-50/50' :
                  item.status === 'error' ? 'bg-red-50/50' :
                  item.status === 'importing' ? 'bg-blue-50/50' : ''
                }`}
              >
                {item.status === 'idle' ? (
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleItem(item.url)}
                    disabled={importing}
                    className="shrink-0"
                  />
                ) : item.status === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : item.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`truncate font-mono text-xs ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                    {shortUrl(item.url)}
                  </p>
                  {item.status === 'done' && item.title && (
                    <p className="text-xs text-emerald-700 truncate">{item.title}</p>
                  )}
                  {item.status === 'error' && (
                    <p className="text-xs text-destructive truncate">{item.errorMsg}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Import progress */}
          {importing && (
            <div className="space-y-1">
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {doneCount + errorCount} of {urlItems.filter((i) => i.status !== 'idle' || i.selected).length} processed
              </p>
            </div>
          )}

          {/* Stats when done */}
          {importDone && (
            <div className="flex items-center gap-4 text-sm">
              {doneCount > 0 && <span className="text-emerald-600 font-medium">{doneCount} imported</span>}
              {errorCount > 0 && <span className="text-destructive">{errorCount} failed</span>}
            </div>
          )}

          {/* Action buttons */}
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
                disabled={selectedCount === 0 || importing}
                className="bg-[#2323A3] hover:bg-[#2323A3]/90"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import {selectedCount} Post{selectedCount !== 1 ? 's' : ''} as Drafts
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setUrlItems([]); setInputUrl(''); setImportDone(false); }}>
                Import More
              </Button>
              <Button type="button" onClick={() => router.push('/library?type=blog')} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
                View in Library
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
