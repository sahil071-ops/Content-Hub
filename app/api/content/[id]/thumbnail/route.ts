import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { uploadToR2, getR2PublicUrl } from '@/lib/storage/r2';

/**
 * POST /api/content/[id]/thumbnail
 * Receives a base64-encoded JPEG thumbnail, uploads it to R2,
 * and updates the content_item.thumbnail_url.
 *
 * Body: { data_url: string }  — data:image/jpeg;base64,...
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data_url } = await request.json();
  if (!data_url || !data_url.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid data_url' }, { status: 400 });
  }

  // Strip the data URL prefix and decode
  const base64 = data_url.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  // Store at thumbnails/{content-id}.jpg
  const filePath = `thumbnails/${params.id}.jpg`;

  try {
    const publicUrl = await uploadToR2(filePath, buffer, 'image/jpeg');

    // Update the content item
    const svc = createServiceClient();
    const { error } = await svc
      .from('content_items')
      .update({ thumbnail_url: publicUrl })
      .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ thumbnail_url: publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
