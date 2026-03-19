import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();

    // Auth check — must be admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete users.' }, { status: 403 });
    }

    const { userId } = await request.json() as { userId: string };
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient();

    // Delete from Supabase Auth — this cascades to public.users if FK is set up
    const { error } = await serviceSupabase.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also delete from public.users in case cascade isn't configured
    await serviceSupabase.from('users').delete().eq('id', userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
