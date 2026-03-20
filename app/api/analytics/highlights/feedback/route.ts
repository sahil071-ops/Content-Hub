import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { highlight_row_id, highlight_id, vote } = await request.json() as {
    highlight_row_id: string;
    highlight_id: string;
    vote: 'up' | 'down';
  };

  // Fetch current feedback JSONB
  const { data: row, error: fetchErr } = await supabase
    .from('mis_highlights')
    .select('feedback')
    .eq('id', highlight_row_id)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const feedback = ((row as any)?.feedback || {}) as Record<string, string>;
  feedback[highlight_id] = vote;

  const { error } = await supabase
    .from('mis_highlights')
    .update({ feedback })
    .eq('id', highlight_row_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
