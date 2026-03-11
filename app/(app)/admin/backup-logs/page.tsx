import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BackupLogsTable } from '@/components/admin/backup-logs-table';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Backup Monitor' };
export const dynamic = 'force-dynamic';

export default async function BackupLogsPage() {
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

  const { data: logs } = await supabase
    .from('backup_logs')
    .select(`
      *,
      content_item:content_items(id, title, content_type)
    `)
    .order('attempted_at', { ascending: false })
    .limit(200);

  return (
    <div className="p-6">
      <BackupLogsTable logs={logs || []} />
    </div>
  );
}
