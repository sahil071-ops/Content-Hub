'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, RefreshCw, Loader2, Pencil, Check, X,
  ShieldAlert, Star, ShieldCheck, StarOff, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FeedbackEntry {
  id: string;
  feedback_type: 'spam' | 'quality';
  original_decision: boolean;
  user_decision: boolean;
  user_note: string | null;
  created_at: string;
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
    title: string | null;
  } | null;
}

function entryLabel(e: FeedbackEntry) {
  if (e.feedback_type === 'spam') {
    if (e.user_decision && !e.original_decision) return { text: 'Marked as spam',       color: 'bg-red-500/20 text-red-300 border-red-500/30',     icon: ShieldAlert };
    if (!e.user_decision && e.original_decision) return { text: 'Cleared as not spam',  color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: ShieldCheck };
    if (e.user_decision) return { text: 'Confirmed spam',        color: 'bg-red-500/10 text-red-400 border-red-500/20',     icon: ShieldAlert };
    return                 { text: 'Confirmed clean',            color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: ShieldCheck };
  } else {
    if (e.user_decision && !e.original_decision) return { text: 'Upgraded to high-value',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Star };
    if (!e.user_decision && e.original_decision) return { text: 'Downgraded from high-value', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: StarOff };
    if (e.user_decision) return { text: 'Confirmed high-value',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Star };
    return                 { text: 'Confirmed not high-value',   color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: StarOff };
  }
}

function wasOverride(e: FeedbackEntry) {
  return e.user_decision !== e.original_decision;
}

export default function AiLearningsPage() {
  const [entries, setEntries]       = useState<FeedbackEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [reevaluating, setReevaluating] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editNote, setEditNote]     = useState('');
  const [userRole, setUserRole]     = useState('');
  const [filter, setFilter]         = useState<'all' | 'spam' | 'quality' | 'overrides'>('all');

  const isEditor = ['admin', 'marketing'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedbackRes, meRes] = await Promise.all([
        fetch('/api/leads/feedback'),
        fetch('/api/me'),
      ]);
      if (feedbackRes.ok) setEntries((await feedbackRes.json()).feedback ?? []);
      if (meRes.ok) setUserRole((await meRes.json()).role ?? '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(id: string) {
    const res = await fetch('/api/leads/feedback', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Training example removed');
    } else {
      toast.error('Failed to delete');
    }
  }

  async function saveNote(id: string) {
    const res = await fetch('/api/leads/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, user_note: editNote }),
    });
    if (res.ok) {
      const { entry } = await res.json();
      setEntries(prev => prev.map(e => e.id === id ? { ...e, user_note: entry.user_note } : e));
      setEditingId(null);
      toast.success('Note updated');
    } else {
      toast.error('Failed to save');
    }
  }

  async function reevaluateAll() {
    setReevaluating(true);
    try {
      const res = await fetch('/api/leads/reevaluate', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      const { updated, spam, high_value } = await res.json();
      toast.success(`Re-evaluated ${updated} leads — ${spam} spam, ${high_value} high-value`);
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setReevaluating(false);
    }
  }

  const filtered = entries.filter(e => {
    if (filter === 'spam')      return e.feedback_type === 'spam';
    if (filter === 'quality')   return e.feedback_type === 'quality';
    if (filter === 'overrides') return wasOverride(e);
    return true;
  });

  const overrideCount = entries.filter(wasOverride).length;
  const spamCount     = entries.filter(e => e.feedback_type === 'spam').length;
  const qualityCount  = entries.filter(e => e.feedback_type === 'quality').length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-purple-500" />
            <h1 className="text-xl font-semibold text-foreground">AI Learnings</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Every time you correct the AI or confirm its decision, it learns. Here's what it knows.
          </p>
        </div>
        {isEditor && (
          <Button
            variant="outline"
            size="sm"
            onClick={reevaluateAll}
            disabled={reevaluating || entries.length === 0}
            className="shrink-0 gap-2"
          >
            {reevaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Re-evaluate all leads
          </Button>
        )}
      </div>

      {/* Stats row */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-2xl font-bold">{entries.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total training examples</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-2xl font-bold text-amber-500">{overrideCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Times you corrected the AI</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-2xl font-bold text-emerald-500">{entries.length - overrideCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Times the AI was right</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all',       label: `All (${entries.length})` },
            { key: 'spam',      label: `Spam (${spamCount})` },
            { key: 'quality',   label: `Quality (${qualityCount})` },
            { key: 'overrides', label: `Corrections (${overrideCount})` },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No training data yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use the thumbs up / down buttons on leads to teach the AI.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No entries match this filter.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((entry) => {
            const lbl      = entryLabel(entry);
            const Icon     = lbl.icon;
            const override = wasOverride(entry);
            const name     = [entry.lead?.first_name, entry.lead?.last_name].filter(Boolean).join(' ') || entry.lead?.email || 'Unknown';

            return (
              <div key={entry.id} className="p-4 flex gap-4 group">
                <div className={cn('mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border shrink-0', lbl.color)}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Lead name + label */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{name}</span>
                    {entry.lead?.company && (
                      <span className="text-xs text-muted-foreground">· {entry.lead.company}</span>
                    )}
                    {entry.lead?.title && (
                      <span className="text-xs text-muted-foreground">· {entry.lead.title}</span>
                    )}
                  </div>

                  {/* What happened */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-xs border', lbl.color)}>
                      {lbl.text}
                    </Badge>
                    {override && (
                      <span className="text-xs text-muted-foreground">
                        AI said: {entry.original_decision ? 'yes' : 'no'} → you said: {entry.user_decision ? 'yes' : 'no'}
                      </span>
                    )}
                  </div>

                  {/* Note */}
                  {editingId === entry.id ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        autoFocus
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNote(entry.id); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Explain why (helps the AI understand the pattern)…"
                      />
                      <button onClick={() => saveNote(entry.id)} className="text-emerald-500 hover:text-emerald-400">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : entry.user_note ? (
                    <p className="text-xs text-muted-foreground italic">"{entry.user_note}"</p>
                  ) : null}

                  <p className="text-xs text-muted-foreground/50">
                    {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Actions */}
                {isEditor && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                    <button
                      onClick={() => { setEditingId(entry.id); setEditNote(entry.user_note ?? ''); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors dark:hover:bg-red-500/10"
                      title="Remove training example"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
