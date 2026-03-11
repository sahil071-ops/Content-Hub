import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadForm } from '@/components/upload/upload-form';
import type { TagRow } from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Upload Content' };
export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  // Role guard — server side
  if (!['admin', 'marketing'].includes((userProfile as any)?.role || '')) {
    redirect('/library');
  }

  const { data: allTags } = await supabase
    .from('tags_master')
    .select('*')
    .order('name');

  const productTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'product');
  const topicTags = (allTags || []).filter((t: TagRow) => t.tag_type === 'topic');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Upload Content</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add files, videos, or blog posts to the content library.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <UploadForm productTags={productTags} topicTags={topicTags} />
      </div>
    </div>
  );
}
