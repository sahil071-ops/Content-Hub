import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getR2PresignedUploadUrl, getR2PublicUrl } from '@/lib/storage/r2';
import { buildFilePath } from '@/lib/utils';
import type { PresignedUploadRequest } from '@/types/database';

// Inline UUID v4 without dependency — generate in-app
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown };

    if (!['admin', 'marketing'].includes((profile as any)?.role || '')) {
      return NextResponse.json({
        error: 'Access denied. Only Admin and Marketing users can upload files.',
      }, { status: 403 });
    }

    const body: PresignedUploadRequest = await request.json();
    const { filename, content_type_mime, content_type } = body;

    if (!filename || !content_type_mime || !content_type) {
      return NextResponse.json({
        error: 'Missing required fields: filename, content_type_mime, content_type',
      }, { status: 400 });
    }

    const fileId = generateUUID();
    const filePath = buildFilePath(content_type, filename, fileId);

    // Get presigned URL from R2
    let upload_url: string;
    try {
      upload_url = await getR2PresignedUploadUrl(filePath, content_type_mime);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'R2 configuration error';
      return NextResponse.json({
        error: message,
        hint: 'Check that R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL are set in your environment variables.',
      }, { status: 500 });
    }

    let public_url: string;
    try {
      public_url = getR2PublicUrl(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'R2 public URL error';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ upload_url, file_path: filePath, public_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
