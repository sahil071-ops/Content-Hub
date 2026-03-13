import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MassBlogImport } from '@/components/upload/mass-blog-import';
import type { TagRow, UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import Blogs' };

export default async function MassBlogImportPage() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', authUser!.id).single() as { data: { role: string } | null; error: unknown };
  const userRole = ((userProfile as any)?.role || '') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  const { data: allTags } = await supabase.from('tags_master').select('*').order('name');
  const productTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'product');
  const topicTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'topic');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Import Blogs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your website URL and we&apos;ll find all your blog posts and import them at once.
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
        <MassBlogImport productTags={productTags} topicTags={topicTags} />
      </div>

      <div className="mt-4 rounded-lg bg-muted/40 border p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How it works</p>
        <p>1. We scan your sitemap (sitemap.xml) first for the most accurate list of posts.</p>
        <p>2. If no sitemap is found, we scan your blog page and extract post links.</p>
        <p>3. Each post is archived — its title, text, and cover image are saved to the database.</p>
        <p>4. All posts are saved as <strong>drafts</strong>. Add tags and publish from the library.</p>
        <p className="text-amber-600">Note: Some sites block automated access. Posts that can&apos;t be fetched will be marked as failed and can be added manually.</p>
      </div>
    </div>
  );
}
