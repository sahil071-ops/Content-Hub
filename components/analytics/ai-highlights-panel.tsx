'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MisHighlight, HighlightItem } from '@/types/database';

interface AiHighlightsPanelProps {
  highlight: MisHighlight | null;
}

const TAG_STYLES = {
  WIN:         { bg: 'bg-emerald-500', text: 'text-white', border: 'border-l-emerald-500', card: 'bg-emerald-50 dark:bg-emerald-950/30' },
  PROBLEM:     { bg: 'bg-red-500',     text: 'text-white', border: 'border-l-red-500',     card: 'bg-red-50 dark:bg-red-950/30' },
  OPPORTUNITY: { bg: 'bg-amber-500',   text: 'text-white', border: 'border-l-amber-500',   card: 'bg-amber-50 dark:bg-amber-950/30' },
  WATCH:       { bg: 'bg-blue-500',    text: 'text-white', border: 'border-l-blue-500',    card: 'bg-blue-50 dark:bg-blue-950/30' },
};

// Fallback for old highlights that only have sentiment
const SENTIMENT_FALLBACK: Record<string, keyof typeof TAG_STYLES> = {
  positive: 'WIN',
  warning:  'OPPORTUNITY',
  anomaly:  'WATCH',
};

function getTag(item: HighlightItem): keyof typeof TAG_STYLES {
  if (item.tag && item.tag in TAG_STYLES) return item.tag;
  return SENTIMENT_FALLBACK[item.sentiment] ?? 'WATCH';
}

const SOURCE_LABELS: Record<string, string> = {
  ga4: 'GA4',
  search_console: 'Search Console',
  youtube: 'YouTube',
  brevo: 'Brevo',
};

function HighlightCard({
  item,
  vote,
  saving,
  onVote,
}: {
  item: HighlightItem;
  vote: 'up' | 'down' | undefined;
  saving: boolean;
  onVote: (v: 'up' | 'down') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tag  = getTag(item);
  const style = TAG_STYLES[tag];

  return (
    <div className={cn('rounded-lg border-l-4 overflow-hidden', style.border, style.card)}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tracking-wide', style.bg, style.text)}>
              {tag}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {SOURCE_LABELS[item.source] || item.source}
            </span>
          </div>
          {/* Feedback buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onVote('up')}
              disabled={saving}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                vote === 'up'
                  ? 'bg-emerald-500 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label="Helpful"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onVote('down')}
              disabled={saving}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                vote === 'down'
                  ? 'bg-red-500 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label="Not helpful"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Insight text */}
        <p className="text-sm leading-relaxed">{item.text}</p>

        {/* Collapsible data points */}
        {item.data_points && item.data_points.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} supporting data
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1">
                {item.data_points.map((dp, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-muted-foreground/50 shrink-0">•</span>{dp}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
        body: JSON.stringify({ highlight_row_id: highlight.id, highlight_id: item.id, vote }),
      });
      setFeedback(prev => ({ ...prev, [item.id]: vote }));
    } catch {
      toast.error('Failed to save feedback');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#2323A3]" />
          <h2 className="font-semibold text-base">AI Highlights</h2>
          <span className="text-xs text-muted-foreground">
            {new Date(highlight.period_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}–
            {new Date(highlight.period_end).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(['WIN', 'PROBLEM', 'OPPORTUNITY', 'WATCH'] as const).map(tag => (
            <span key={tag} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-sm inline-block', TAG_STYLES[tag].bg)} />
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {highlight.highlights.map((item) => (
          <HighlightCard
            key={item.id}
            item={item}
            vote={feedback[item.id]}
            saving={saving === item.id}
            onVote={(v) => handleVote(item, v)}
          />
        ))}
      </div>
    </div>
  );
}
