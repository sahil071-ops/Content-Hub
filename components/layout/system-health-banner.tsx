'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';
import type { HealthIssue } from '@/lib/health';

interface SystemHealthBannerProps {
  issues: HealthIssue[];
}

const DISMISS_KEY = 'health_dismissed_ids';

export function SystemHealthBanner({ issues }: SystemHealthBannerProps) {
  const [visible, setVisible] = useState<HealthIssue[]>([]);

  useEffect(() => {
    // Filter out issues the user has already dismissed this session
    try {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]');
      setVisible(issues.filter((i) => !dismissed.includes(i.id)));
    } catch {
      setVisible(issues);
    }
  }, [issues]);

  function dismiss(id: string) {
    setVisible((prev) => prev.filter((i) => i.id !== id));
    try {
      const dismissed: string[] = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]');
      if (!dismissed.includes(id)) dismissed.push(id);
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed));
    } catch { /* ignore */ }
  }

  if (visible.length === 0) return null;

  return (
    <div className="z-40">
      {visible.map((issue) => (
        <div
          key={issue.id}
          className={`flex items-start gap-3 px-4 py-3 text-sm ${
            issue.severity === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-amber-500 text-white'
          }`}
        >
          {issue.severity === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{issue.title}. </span>
            <span className="opacity-90">{issue.detail}</span>
          </div>
          <button
            onClick={() => dismiss(issue.id)}
            className="shrink-0 opacity-80 hover:opacity-100 transition-opacity ml-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
