import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { backupUrlToB2 } from '@/lib/storage/b2';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { content_id, file_url, file_path, file_type, backup_log_id } = body;

    if (!content_id || !file_url) {
      return NextResponse.json({
        error: 'Missing required fields: content_id and file_url',
      }, { status: 400 });
    }

    // Create or update backup log entry
    let logId = backup_log_id;

    if (!logId) {
      const { data: log } = await serviceSupabase
        .from('backup_logs')
        .insert({
          content_id,
          r2_url: file_url,
          status: 'pending',
        })
        .select('id')
        .single();
      logId = log?.id;
    } else {
      await serviceSupabase
        .from('backup_logs')
        .update({ status: 'pending', attempted_at: new Date().toISOString() })
        .eq('id', logId);
    }

    // Perform the backup
    try {
      const b2Url = await backupUrlToB2(
        file_url,
        file_path || new URL(file_url).pathname.slice(1),
        file_type || 'application/octet-stream'
      );

      // Update backup log with success
      await serviceSupabase
        .from('backup_logs')
        .update({
          status: 'success',
          b2_url: b2Url,
          error_message: null,
        })
        .eq('id', logId);

      // Update content item with B2 URL
      await serviceSupabase
        .from('content_items')
        .update({ backup_url: b2Url })
        .eq('id', content_id);

      return NextResponse.json({ success: true, b2_url: b2Url });
    } catch (backupErr) {
      const errorMsg = backupErr instanceof Error ? backupErr.message : 'Backup failed';

      // Log the failure
      if (logId) {
        await serviceSupabase
          .from('backup_logs')
          .update({
            status: 'failed',
            error_message: errorMsg,
          })
          .eq('id', logId);
      }

      return NextResponse.json({
        error: errorMsg,
        hint: 'Check that B2_ENDPOINT, B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY, and B2_BUCKET_NAME are set correctly in your environment variables.',
      }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
