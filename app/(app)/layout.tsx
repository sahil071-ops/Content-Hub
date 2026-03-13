import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { Footer } from '@/components/layout/footer';
import { SystemHealthBanner } from '@/components/layout/system-health-banner';
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
    // Profile not found — sign out and redirect
    redirect('/login?error=profile_missing');
  }

  const user = userProfile as UserRow;

  const canSeeHealth = ['admin', 'marketing'].includes(user.role);
  const healthIssues = canSeeHealth ? await getHealthIssues() : [];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        <AppSidebar userRole={user.role} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col md:pl-64 min-h-screen">
        <TopNav user={user} />

        {/* System health banner — admin/marketing only */}
        {healthIssues.length > 0 && (
          <SystemHealthBanner issues={healthIssues} />
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
