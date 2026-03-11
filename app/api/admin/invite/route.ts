import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { UserRoleEnum } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Auth check — must be admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite users.' }, { status: 403 });
    }

    const { email, role } = await request.json() as { email: string; role: UserRoleEnum };

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    // Use Supabase Admin API to invite user
    const { data, error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      data: { role: role || 'viewer' },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/library`,
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        return NextResponse.json({
          error: `A user with the email ${email} already exists. You can update their role directly from the user list.`,
        }, { status: 409 });
      }
      return NextResponse.json({
        error: error.message,
        hint: 'Make sure SUPABASE_SERVICE_ROLE_KEY is set and Supabase email is configured in your project settings.',
      }, { status: 500 });
    }

    // If user was created, pre-set their role in the users table
    if (data.user) {
      await serviceSupabase
        .from('users')
        .upsert({ id: data.user.id, role: role || 'viewer' }, { onConflict: 'id' });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
