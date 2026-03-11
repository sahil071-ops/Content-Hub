'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfViewerProps {
  url: string;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

export function PdfViewer({ url, onThumbnailGenerated }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use native browser PDF embedding as the primary viewer
  // This avoids heavy pdf.js bundle and works for the detail page preview
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 p-2 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground">PDF Preview</span>
      </div>

      {/* PDF embed */}
      <div className="flex-1 relative">
        <iframe
          src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
          className="w-full h-full min-h-[500px]"
          title="PDF Preview"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Could not load PDF preview. You can download the file to view it.');
          }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center px-4">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Client-side thumbnail generator using pdf.js
// Called during upload to auto-generate the first-page thumbnail
export async function generatePdfThumbnail(file: File): Promise<string | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (err) {
    console.error('PDF thumbnail generation failed:', err);
    return null;
  }
}
