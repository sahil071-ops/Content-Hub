import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UploadCompleteRequest } from '@/types/database';

async function getAuthedProfile(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null; error: unknown };
  return { user, profile };
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    const { user, profile } = await getAuthedProfile(supabase);
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    if (!['admin', 'marketing'].includes((profile as any)?.role || '')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const body: UploadCompleteRequest & {
      id: string;
      status?: 'draft' | 'published';
    } = await request.json();

    const {
      id, title, description, content_type, file_url, external_link,
      thumbnail_url, product_tags, topic_tags, audience_tags,
      file_size_bytes, file_type_mime, meta, status = 'draft',
    } = body;

    if (!id) return NextResponse.json({ error: 'ID is required.' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

    const now = new Date().toISOString();

    // Get existing published_at so we don't reset it on re-publish
    const { data: existing } = await supabase
      .from('content_items')
      .select('published_at')
      .eq('id', id)
      .single() as { data: { published_at: string | null } | null; error: unknown };

    const updatePayload: Record<string, unknown> = {
      title,
      description: description || null,
      content_type,
      product_tags: product_tags || [],
      topic_tags: topic_tags || [],
      audience_tags: (audience_tags || []) as unknown,
      status,
      published_at: status === 'published' ? (existing?.published_at || now) : null,
    };
    if (file_url) updatePayload.file_url = file_url;
    if (external_link !== undefined) updatePayload.external_link = external_link || null;
    if (thumbnail_url) updatePayload.thumbnail_url = thumbnail_url;
    if (file_size_bytes) updatePayload.file_size_bytes = file_size_bytes;
    if (file_type_mime) updatePayload.file_type = file_type_mime;
    if (meta) updatePayload.meta = meta;

    const { data: item, error } = await supabase
      .from('content_items')
      .update(updatePayload)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update content.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: item.id, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { user, profile } = await getAuthedProfile(supabase);
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    if (!['admin', 'marketing'].includes((profile as any)?.role || '')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const body: UploadCompleteRequest & {
      status?: 'draft' | 'published';
      file_path?: string;
    } = await request.json();

    const {
      title, description, content_type, file_url, external_link,
      thumbnail_url, product_tags, topic_tags, audience_tags,
      file_size_bytes, file_type_mime, meta, status = 'draft',
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: item, error } = await supabase
      .from('content_items')
      .insert({
        title,
        description: description || null,
        content_type,
        file_url: file_url || null,
        external_link: external_link || null,
        thumbnail_url: thumbnail_url || null,
        product_tags: product_tags || [],
        topic_tags: topic_tags || [],
        audience_tags: (audience_tags || []) as any,
        status,
        published_at: status === 'published' ? now : null,
        created_by: user.id,
        file_size_bytes: file_size_bytes || null,
        file_type: file_type_mime || null,
        meta: meta || {},
        engagement_data: {},
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({
        error: 'Failed to save content to database.',
        detail: error.message,
        hint: 'Check that your Supabase credentials are correct and the database migration has been run.',
      }, { status: 500 });
    }

    return NextResponse.json({ id: item.id, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
