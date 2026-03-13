import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadForm } from '@/components/upload/upload-form';
import type { ContentItem, TagRow, UserRoleEnum } from '@/types/database';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface UploadPageProps {
  searchParams: { edit?: string };
}

export async function generateMetadata({ searchParams }: UploadPageProps): Promise<Metadata> {
  return { title: searchParams.edit ? 'Edit Content' : 'Upload Content' };
}

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  const userRole = ((userProfile as any)?.role || '') as UserRoleEnum;

  if (!['admin', 'marketing'].includes(userRole)) {
    redirect('/library');
  }

  const { data: allTags } = await supabase
    .from('tags_master')
    .select('*')
    .order('name');

  const productTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'product');
  const topicTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'topic');
  const mediumTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'medium');

  // Load existing item if editing
  let editItem: ContentItem | null = null;
  if (searchParams.edit) {
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', searchParams.edit)
      .single();
    editItem = data as ContentItem | null;
  }

  const isEdit = !!editItem;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isEdit ? 'Edit Content' : 'Upload Content'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEdit
                ? 'Update the details for this content item.'
                : 'Add files, videos, or blog posts to the content library.'}
            </p>
          </div>
          {!isEdit && (
            <Link
              href="/upload/batch"
              className="shrink-0 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Batch Upload
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <UploadForm
          productTags={productTags}
          topicTags={topicTags}
          mediumTags={mediumTags}
          userRole={userRole as 'admin' | 'marketing'}
          initialData={editItem}
        />
      </div>
    </div>
  );
}
