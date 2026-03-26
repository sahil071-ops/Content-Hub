'use client';

import { useState, useCallback } from 'react';
import { ImagePlus, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PendingItem {
  id: string;
  title: string;
  file_url: string;
  content_type: string;
}

interface ItemResult {
  id: string;
  title: string;
  status: 'done' | 'error';
  error?: string;
}

const PDF_CONTENT_TYPES = new Set([
  'pdf', 'ebook', 'whitepaper', 'catalogue',
  'flier', 'presentation', 'emailer',
]);

/**
 * Fetches the first page of a PDF from a URL and returns a JPEG data URL.
 * Uses pdf.js dynamically — no server-side processing needed.
 */
async function generateThumbnailFromUrl(url: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Use a CDN worker — avoids bundling the worker
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // Render at a size suitable for a card thumbnail (~640px wide)
  const viewport = page.getViewport({ scale: 1.0 });
  const targetWidth = 640;
  const scale = targetWidth / viewport.width;
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width  = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function PdfThumbnailGenerator({ items }: { items: PendingItem[] }) {
  const [open, setOpen]       = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  const pending = items.filter(i => PDF_CONTENT_TYPES.has(i.content_type));

  const run = useCallback(async () => {
    if (!pending.length) return;
    setRunning(true);
    setResults([]);

    for (const item of pending) {
      setCurrent(item.title);
      try {
        const dataUrl = await generateThumbnailFromUrl(item.file_url);
        const res = await fetch(`/api/content/${item.id}/thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data_url: dataUrl }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }
        setResults(prev => [...prev, { id: item.id, title: item.title, status: 'done' }]);
      } catch (e) {
        setResults(prev => [...prev, {
          id: item.id, title: item.title,
          status: 'error', error: (e as Error).message,
        }]);
      }
    }

    setCurrent(null);
    setRunning(false);
    const done = pending.length;
    toast.success(`Thumbnails generated for ${done} PDF${done !== 1 ? 's' : ''}. Refresh the page to see them.`);
  }, [pending]);

  if (pending.length === 0) return null;

  const done  = results.filter(r => r.status === 'done').length;
  const errors = results.filter(r => r.status === 'error').length;

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ImagePlus className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 font-medium">
          {pending.length} PDF{pending.length !== 1 ? 's' : ''} missing thumbnails
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Generate first-page preview images for all PDF-type content (eBooks, catalogues, whitepapers, etc.) that currently show a generic icon. This runs in your browser — no server processing needed.
          </p>

          <Button
            size="sm"
            onClick={run}
            disabled={running || (results.length > 0 && errors === 0)}
            className="gap-2"
          >
            {running
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating… {results.length}/{pending.length}</>
              : results.length > 0
              ? <><CheckCircle2 className="h-3.5 w-3.5" />Done — refresh to see thumbnails</>
              : <><ImagePlus className="h-3.5 w-3.5" />Generate {pending.length} thumbnails</>}
          </Button>

          {/* Progress list */}
          {(running || results.length > 0) && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  {r.status === 'done'
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span className="truncate text-muted-foreground">{r.title}</span>
                  {r.error && <span className="text-red-500 truncate">{r.error}</span>}
                </div>
              ))}
              {running && current && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span className="truncate">{current}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
