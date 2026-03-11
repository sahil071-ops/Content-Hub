'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { formatDateTime } from '@/lib/utils';
import type { BackupLog } from '@/types/database';

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    className: 'bg-red-100 text-[#FF0004] border-red-200',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
};

interface BackupLogsTableProps {
  logs: BackupLog[];
}

export function BackupLogsTable({ logs }: BackupLogsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retrying, setRetrying] = useState<string | null>(null);

  async function handleRetry(log: BackupLog) {
    if (!log.r2_url || !log.content_id) {
      toast.error('Cannot retry', { description: 'Missing R2 URL or content ID for this backup entry.' });
      return;
    }

    setRetrying(log.id);

    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: log.content_id,
          file_url: log.r2_url,
          backup_log_id: log.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error('Retry failed', { description: json.error || 'Backup retry failed. Check your B2 credentials.' });
      } else {
        toast.success('Backup retried successfully');
        startTransition(() => router.refresh());
      }
    } catch (err) {
      toast.error('Network error during retry. Please try again.');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backup Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status of all Cloudflare R2 → Backblaze B2 backup operations.
          </p>
        </div>
        <Button variant="outline" onClick={() => startTransition(() => router.refresh())}>
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {(['success', 'failed', 'pending'] as const).map((status) => {
          const count = logs.filter((l) => l.status === status).length;
          const { icon: Icon, label, className } = STATUS_CONFIG[status];
          return (
            <div key={status} className="rounded-lg border bg-card p-4 flex items-center gap-3">
              <Icon className="h-6 w-6 shrink-0" />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempted</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No backup records yet. Backups are created when files are uploaded.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const { icon: Icon, label, className } = STATUS_CONFIG[log.status];
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="max-w-[200px]">
                        {log.content_item ? (
                          <>
                            <p className="text-sm font-medium truncate">{log.content_item.title}</p>
                            <p className="text-xs text-muted-foreground truncate font-mono">{log.r2_url}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono truncate">{log.r2_url || '—'}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}>
                        <Icon className="h-3 w-3" />
                        {label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(log.attempted_at)}
                    </TableCell>
                    <TableCell>
                      {log.error_message ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-xs text-destructive max-w-[180px] truncate">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span className="truncate">{log.error_message}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-xs whitespace-pre-wrap">{log.error_message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(log)}
                          disabled={retrying === log.id}
                          className="h-7 text-xs"
                        >
                          {retrying === log.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
