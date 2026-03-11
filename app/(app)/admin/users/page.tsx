import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { UsersManager } from '@/components/admin/users-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'User Management' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
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

  // Use service role to fetch all users including auth emails
  const serviceSupabase = createServiceClient();

  // Get all profiles
  const { data: profilesRaw } = await serviceSupabase
    .from('users')
    .select('*')
    .order('created_at');

  const profiles = (profilesRaw || []) as any[];

  // Get auth emails (requires service role)
  const { data: { users: authUsers } } = await serviceSupabase.auth.admin.listUsers();

  // Merge profiles with emails
  const usersWithEmail = profiles.map((profile: any) => {
    const au = (authUsers || []).find((u: any) => u.id === profile.id);
    return { ...profile, email: au?.email };
  });

  return (
    <div className="p-6">
      <UsersManager users={usersWithEmail} currentUserId={authUser!.id} />
    </div>
  );
}
