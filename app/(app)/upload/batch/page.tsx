import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BatchUploadForm } from '@/components/upload/batch-upload-form';
import type { TagRow, UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Batch Upload' };

export default async function BatchUploadPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  const userRole = ((userProfile as any)?.role || '') as UserRoleEnum;
  if (!['admin', 'marketing'].includes(userRole)) redirect('/library');

  const { data: allTags } = await supabase.from('tags_master').select('*').order('name');
  const productTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'product');
  const topicTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'topic');
  const mediumTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'medium');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Batch Upload</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload multiple files at once, then fill in details for each one.
            </p>
          </div>
          <Link
            href="/upload"
            className="shrink-0 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Single Upload
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <BatchUploadForm
          productTags={productTags}
          topicTags={topicTags}
          mediumTags={mediumTags}
        />
      </div>
    </div>
  );
}
