'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function BrevoTestPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function runTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/analytics/test-brevo');
      const json = await res.json() as Record<string, unknown>;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={runTest} disabled={loading}>
          {loading ? 'Testing…' : 'Test Brevo Connection'}
        </Button>
        {result !== null && (
          <span className={result.ok ? 'text-emerald-600 dark:text-emerald-400 text-sm font-medium' : 'text-red-600 dark:text-red-400 text-sm font-medium'}>
            {result.ok ? '✓ Connected' : '✗ Failed'}
          </span>
        )}
      </div>
      {result !== null && (
        <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
