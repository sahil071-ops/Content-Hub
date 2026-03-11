import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TagsManager } from '@/components/admin/tags-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tag Management' };
export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  if ((userProfile as any)?.role !== 'admin') {
    redirect('/library');
  }

  const { data: tags } = await supabase
    .from('tags_master')
    .select('*')
    .order('tag_type')
    .order('name');

  return (
    <div className="p-6">
      <TagsManager initialTags={tags || []} />
    </div>
  );
}
