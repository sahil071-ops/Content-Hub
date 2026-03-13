import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';
import { getHealthIssues } from '@/lib/health';
import type { UserRow } from '@/types/database';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (!userProfile) {
    redirect('/login?error=profile_missing');
  }

  const user = userProfile as UserRow;

  const canSeeHealth = ['admin', 'marketing'].includes(user.role);
  const healthIssues = canSeeHealth ? await getHealthIssues() : [];

  return (
    <AppShell user={user} healthIssues={healthIssues}>
      {children}
    </AppShell>
  );
}
