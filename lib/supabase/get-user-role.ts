import { createClient } from '@/lib/supabase/server';
import type { UserRoleEnum } from '@/types/database';

/**
 * Server-side helper: get the authenticated user's role.
 * Returns null if not authenticated or profile not found.
 */
export async function getUserRole(): Promise<UserRoleEnum | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return ((data as any)?.role as UserRoleEnum) ?? null;
}

/**
 * Server-side helper: get the authenticated user's full profile.
 * Returns null if not authenticated or profile not found.
 */
export async function getCurrentUser() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (!profile) return null;
  return profile as any;
}
