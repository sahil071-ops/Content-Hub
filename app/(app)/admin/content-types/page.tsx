import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContentTypesManager } from '@/components/admin/content-types-manager';
import type { ContentTypeRow } from '@/types/database';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Content Types' };
export const dynamic = 'force-dynamic';

export default async function ContentTypesPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser!.id)
    .single() as { data: { role: string } | null; error: unknown };

  if (!['admin', 'marketing'].includes((userProfile as any)?.role || '')) {
    redirect('/library');
  }

  const { data } = await supabase
    .from('content_types')
    .select('*')
    .order('sort_order');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ContentTypesManager initialTypes={(data || []) as ContentTypeRow[]} />
    </div>
  );
}
