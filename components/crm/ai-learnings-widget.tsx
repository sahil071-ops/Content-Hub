'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, ChevronDown, ChevronUp, X, Pencil, Check, Loader2, RefreshCw, ShieldAlert, Star } from 'lucide-react';
import { toast } from 'sonner';
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

export function AiLearningsWidget({ userRole }: { userRole: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reevaluating, setReevaluating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const isEditor = ['admin', 'marketing'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads/feedback');
      if (res.ok) setEntries((await res.json()).feedback ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function deleteEntry(id: string) {
    const res = await fetch('/api/leads/feedback', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Feedback entry removed');
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

  // Group entries into overrides (AI was wrong) and confirmations (AI was right)
  const overrides      = entries.filter(e => e.user_decision !== e.original_decision);
  const confirmations  = entries.filter(e => e.user_decision === e.original_decision);

  // Derive a human-readable description of what the AI learned from an entry
  function describeEntry(e: FeedbackEntry): string {
    const name    = [e.lead?.first_name, e.lead?.last_name].filter(Boolean).join(' ') || e.lead?.email || 'Unknown';
    const company = e.lead?.company ? ` (${e.lead.company})` : '';

    if (e.feedback_type === 'spam') {
      if (e.user_decision && !e.original_decision) return `${name}${company} → actually spam`;
      if (!e.user_decision && e.original_decision) return `${name}${company} → not spam`;
      if (e.user_decision)  return `Confirmed spam: ${name}${company}`;
      return `Confirmed clean: ${name}${company}`;
    } else {
      if (e.user_decision && !e.original_decision) return `${name}${company} → upgraded to high-value`;
      if (!e.user_decision && e.original_decision) return `${name}${company} → downgraded from high-value`;
      if (e.user_decision)  return `Confirmed high-value: ${name}${company}`;
      return `Confirmed not high-value: ${name}${company}`;
    }
  }

  if (entries.length === 0 && !open) {
    // Show as a small prompt to start training
    return (
      <div className="mx-2 mt-3">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <Brain className="h-3.5 w-3.5 shrink-0" />
          AI has no training yet
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mt-3">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Brain className="h-3.5 w-3.5 shrink-0 text-purple-400" />
        <span className="flex-1 text-left font-medium">
          AI Learnings
          {entries.length > 0 && (
            <span className="ml-1.5 text-white/30">({entries.length})</span>
          )}
        </span>
        {open
          ? <ChevronUp className="h-3 w-3 shrink-0" />
          : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>

      {open && (
        <div className="mt-1 rounded-md bg-white/5 border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-white/30" />
            </div>
          ) : (
            <>
              {/* Summary */}
              {entries.length > 0 && (
                <div className="px-3 py-2 border-b border-white/10 space-y-1">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">What the AI has learned</p>
                  <div className="flex gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3 text-red-400" />
                      {overrides.filter(e => e.feedback_type === 'spam').length} spam corrections
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      {overrides.filter(e => e.feedback_type === 'quality').length} quality corrections
                    </span>
                  </div>
                  {confirmations.length > 0 && (
                    <p className="text-[10px] text-white/30">
                      + {confirmations.length} confirmation{confirmations.length !== 1 ? 's' : ''} (AI was right)
                    </p>
                  )}
                </div>
              )}

              {/* Entry list — show overrides first (more informative), then confirmations */}
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {[...overrides, ...confirmations].map(entry => (
                  <div key={entry.id} className="px-3 py-2 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className={cn(
                        'mt-0.5 h-1.5 w-1.5 rounded-full shrink-0',
                        entry.feedback_type === 'spam'
                          ? (entry.user_decision ? 'bg-red-400' : 'bg-emerald-400')
                          : (entry.user_decision ? 'bg-amber-400' : 'bg-slate-400'),
                      )} />
                      <p className="text-xs text-white/70 flex-1 leading-snug">{describeEntry(entry)}</p>
                      {isEditor && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingId(entry.id); setEditNote(entry.user_note ?? ''); }}
                            className="text-white/30 hover:text-white/70 transition-colors"
                            title="Edit note"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                            title="Delete this training example"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    {editingId === entry.id ? (
                      <div className="flex gap-1 mt-1">
                        <input
                          autoFocus
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveNote(entry.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 rounded bg-white/10 text-xs text-white px-2 py-0.5 outline-none border border-white/20 focus:border-purple-400"
                          placeholder="Add a note to explain…"
                        />
                        <button onClick={() => saveNote(entry.id)} className="text-emerald-400 hover:text-emerald-300">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-white/30 hover:text-white/60">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : entry.user_note ? (
                      <p className="text-[11px] text-purple-300/70 italic pl-3">"{entry.user_note}"</p>
                    ) : null}
                  </div>
                ))}

                {entries.length === 0 && (
                  <p className="px-3 py-4 text-xs text-white/30 text-center">
                    No feedback yet. Use the thumbs up/down buttons on leads to train the AI.
                  </p>
                )}
              </div>

              {/* Re-evaluate button */}
              {isEditor && entries.length > 0 && (
                <div className="border-t border-white/10 p-2">
                  <button
                    onClick={reevaluateAll}
                    disabled={reevaluating}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium bg-purple-700/40 text-purple-200 hover:bg-purple-700/60 transition-colors disabled:opacity-50"
                  >
                    {reevaluating
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Re-evaluate all leads
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
