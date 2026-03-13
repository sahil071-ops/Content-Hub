import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { YouTubeCsvImport } from '@/components/upload/youtube-csv-import';
import type { UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import YouTube Videos' };

export default async function YouTubeImportPage() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser!.id).single() as { data: { role: string } | null; error: unknown };
  const userRole = ((userProfile as any)?.role || '') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Import YouTube Videos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV file with your YouTube video links — titles and thumbnails are fetched automatically.
            </p>
          </div>
          <Link
            href="/upload"
            className="shrink-0 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Upload
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <YouTubeCsvImport />
      </div>

      <div className="mt-4 rounded-lg bg-muted/40 border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How to prepare your CSV</p>
        <p>1. In Excel or Google Sheets, put your YouTube URLs in any column — one URL per row.</p>
        <p>2. Save / export as <strong>CSV</strong> (File → Save As → CSV, or File → Download → CSV in Google Sheets).</p>
        <p>3. Upload that CSV here. We&apos;ll find all YouTube links automatically — other columns are ignored.</p>
        <p>4. Click <strong>Load Titles & Thumbnails</strong> to fetch video info from YouTube.</p>
        <p>5. Select the videos to import and click <strong>Import</strong> — they&apos;re saved as drafts.</p>
        <p className="text-amber-600">Note: Private videos or videos with embeds disabled cannot be fetched automatically.</p>
      </div>
    </div>
  );
}
