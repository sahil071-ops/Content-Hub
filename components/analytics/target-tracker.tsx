'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Pencil, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ContentTarget } from '@/types/database';

interface ProductActual {
  tag_name: string;
  actual_percentage: number;
  count: number;
  total: number;
}

interface TargetTrackerProps {
  actuals: ProductActual[];
  targets: ContentTarget[];
  isAdmin: boolean;
  onTargetsChange?: (targets: ContentTarget[]) => void;
}

export function TargetTracker({ actuals, targets, isAdmin, onTargetsChange }: TargetTrackerProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTargets, setDraftTargets] = useState<Record<string, number>>(
    Object.fromEntries(targets.map((t) => [t.tag_name, t.target_percentage]))
  );

  const tagNames = actuals.map((a) => a.tag_name);

  async function handleSave() {
    setSaving(true);
    try {
      const rows = tagNames.map((name) => ({
        tag_name: name,
        tag_type: 'product',
        target_percentage: draftTargets[name] ?? 0,
      }));
      const res = await fetch('/api/analytics/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: rows }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Targets saved');
      setEditing(false);
    } catch {
      toast.error('Failed to save targets');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end gap-2">
          {editing ? (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3 w-3 mr-1" />{saving ? 'Saving...' : 'Save Targets'}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1" />Edit Targets
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {actuals.map((a) => {
          const target = draftTargets[a.tag_name] ?? 0;
          const diff = a.actual_percentage - target;
          const isBelow = diff < -2;
          const isAbove = diff > 2;

          return (
            <div key={a.tag_name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{a.tag_name}</span>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={draftTargets[a.tag_name] ?? 0}
                        onChange={(e) => setDraftTargets((prev) => ({ ...prev, [a.tag_name]: parseFloat(e.target.value) || 0 }))}
                        className="w-16 h-6 text-xs text-right"
                      />
                      <span className="text-xs text-muted-foreground">% target</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Target: {target}%</span>
                  )}
                  <span className={cn('text-xs font-medium', {
                    'text-red-600 dark:text-red-400': isBelow,
                    'text-emerald-600 dark:text-emerald-400': isAbove,
                    'text-muted-foreground': !isBelow && !isAbove,
                  })}>
                    {a.actual_percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="relative">
                <Progress value={a.actual_percentage} className="h-2" />
                {target > 0 && (
                  <div
                    className="absolute top-0 h-2 w-0.5 bg-primary/60"
                    style={{ left: `${Math.min(target, 100)}%` }}
                    title={`Target: ${target}%`}
                  />
                )}
              </div>

              {isBelow && !editing && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {Math.abs(diff).toFixed(1)}% below target
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
