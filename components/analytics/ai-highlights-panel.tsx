'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MisHighlight, HighlightItem } from '@/types/database';

interface AiHighlightsPanelProps {
  highlight: MisHighlight | null;
}

const SOURCE_LABELS: Record<string, string> = {
  ga4: 'GA4',
  search_console: 'Search Console',
  youtube: 'YouTube',
  brevo: 'Brevo',
};

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-emerald-50 dark:bg-emerald-950/40 border-l-emerald-500',
  warning: 'bg-amber-50 dark:bg-amber-950/40 border-l-amber-500',
  anomaly: 'bg-red-50 dark:bg-red-950/40 border-l-red-500',
};

const SENTIMENT_BADGE: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  anomaly: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function AiHighlightsPanel({ highlight }: AiHighlightsPanelProps) {
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>(
    (highlight?.feedback as Record<string, 'up' | 'down'>) || {}
  );
  const [saving, setSaving] = useState<string | null>(null);

  if (!highlight || !highlight.highlights.length) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-[#2323A3]" />
          <h2 className="font-semibold">AI Highlights</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No highlights yet. Trigger a data pull to generate AI-powered insights.
        </p>
      </div>
    );
  }

  async function handleVote(item: HighlightItem, vote: 'up' | 'down') {
    if (!highlight) return;
    setSaving(item.id);
    try {
      await fetch('/api/analytics/highlights/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          highlight_row_id: highlight.id,
          highlight_id: item.id,
          vote,
        }),
      });
      setFeedback((prev) => ({ ...prev, [item.id]: vote }));
    } catch {
      toast.error('Failed to save feedback');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2323A3]" />
          <h2 className="font-semibold">AI Highlights</h2>
          <span className="text-xs text-muted-foreground">
            {new Date(highlight.period_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}–
            {new Date(highlight.period_end).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Rate these to improve future highlights</span>
      </div>

      <div className="space-y-3">
        {highlight.highlights.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-start justify-between gap-3 p-3 rounded-md border-l-4',
              SENTIMENT_STYLES[item.sentiment] || SENTIMENT_STYLES.positive
            )}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Badge className={cn('shrink-0 text-xs font-normal mt-0.5', SENTIMENT_BADGE[item.sentiment])}>
                {SOURCE_LABELS[item.source] || item.source}
              </Badge>
              <p className="text-sm">{item.text}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', feedback[item.id] === 'up' && 'text-emerald-600')}
                disabled={saving === item.id}
                onClick={() => handleVote(item, 'up')}
                aria-label="Thumbs up"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', feedback[item.id] === 'down' && 'text-red-600')}
                disabled={saving === item.id}
                onClick={() => handleVote(item, 'down')}
                aria-label="Thumbs down"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
