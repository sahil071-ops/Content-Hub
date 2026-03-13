import { createClient } from '@/lib/supabase/server';

export interface HealthIssue {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  detail: string;
}

export async function getHealthIssues(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  // ── R2 storage ─────────────────────────────────────────────────
  const r2Missing = !process.env.R2_ACCESS_KEY_ID
    || !process.env.R2_SECRET_ACCESS_KEY
    || !process.env.R2_ACCOUNT_ID
    || !process.env.R2_BUCKET_NAME;

  if (r2Missing) {
    issues.push({
      id: 'r2_missing',
      severity: 'error',
      title: 'File uploads are disabled',
      detail: 'Cloudflare R2 credentials are not configured. Files cannot be uploaded until R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, and R2_BUCKET_NAME are set.',
    });
  }

  // ── B2 backup ──────────────────────────────────────────────────
  const b2Missing = !process.env.B2_ENDPOINT
    || !process.env.B2_ACCESS_KEY_ID
    || !process.env.B2_SECRET_ACCESS_KEY
    || !process.env.B2_BUCKET_NAME;

  if (b2Missing) {
    issues.push({
      id: 'b2_missing',
      severity: 'warning',
      title: 'Backups are disabled',
      detail: 'Backblaze B2 credentials are not configured. Files will not be backed up until B2_ENDPOINT, B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY, and B2_BUCKET_NAME are set.',
    });
  } else {
    // Check if recent backups are failing
    try {
      const supabase = createClient();
      const { data: recentLogs } = await supabase
        .from('backup_logs')
        .select('status')
        .order('attempted_at', { ascending: false })
        .limit(10);

      if (recentLogs && recentLogs.length >= 3) {
        const failCount = recentLogs.filter((l) => l.status === 'failed').length;
        const totalChecked = recentLogs.length;
        // Warn if more than half of recent backups have failed
        if (failCount > totalChecked / 2) {
          issues.push({
            id: 'backup_failing',
            severity: 'warning',
            title: 'Backups are failing',
            detail: `${failCount} of the last ${totalChecked} backup operations failed. Check the Backup Monitor for details and verify your B2 credentials are correct.`,
          });
        }
      }
    } catch { /* Non-critical — skip if DB query fails */ }
  }

  return issues;
}
