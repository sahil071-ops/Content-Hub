'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Lightbulb, TrendingUp, AlertTriangle, BarChart2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LinkedInAiInsight, LinkedInAccount } from '@/types/database';
import type { PostSuggestion } from '@/app/api/linkedin/suggestions/route';

const INSIGHT_ICONS: Record<string, React.ElementType> = {
  pattern: TrendingUp,
  recommendation: Lightbulb,
  anomaly: AlertTriangle,
  summary: BarChart2,
};

const INSIGHT_COLOURS: Record<string, string> = {
  pattern: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  recommendation: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  anomaly: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  summary: 'bg-muted border-border',
};

const INSIGHT_ICON_COLOURS: Record<string, string> = {
  pattern: 'text-blue-600 dark:text-blue-400',
  recommendation: 'text-amber-600 dark:text-amber-400',
  anomaly: 'text-red-600 dark:text-red-400',
  summary: 'text-muted-foreground',
};

export default function LinkedInInsightsPage() {
  const [insights, setInsights] = useState<LinkedInAiInsight[]>([]);
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [isEditor, setIsEditor] = useState(false);

  // Suggestions panel
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionAccount, setSuggestionAccount] = useState('');
  const [productFocus, setProductFocus] = useState('');
  const [topicFocus, setTopicFocus] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [insightsRes, accRes, meRes] = await Promise.all([
          fetch('/api/linkedin/insights'),
          fetch('/api/linkedin/accounts'),
          fetch('/api/me'),
        ]);
        if (insightsRes.ok) { const { insights: d } = await insightsRes.json(); setInsights(d || []); }
        if (accRes.ok) {
          const { accounts: accs } = await accRes.json();
          setAccounts(accs || []);
          setSuggestionAccount(accs?.[0]?.id || '');
        }
        if (meRes.ok) {
          const me = await meRes.json();
          setIsEditor(['admin', 'marketing'].includes(me?.role));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const body: Record<string, any> = { period_days: 90 };
      if (selectedAccount !== 'all') body.account_id = selectedAccount;

      const res = await fetch('/api/linkedin/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const { insights: newInsights } = await res.json();
      setInsights(prev => [...newInsights, ...prev]);
      toast.success(`${newInsights.length} new insight${newInsights.length !== 1 ? 's' : ''} generated`);
    } catch {
      toast.error('Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  }

  async function handleThumbsFeedback(id: string, thumbs_up: boolean) {
    const insight = insights.find(i => i.id === id);
    const newValue = insight?.thumbs_up === thumbs_up ? null : thumbs_up;

    setInsights(prev => prev.map(i => i.id === id ? { ...i, thumbs_up: newValue } : i));

    await fetch('/api/linkedin/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, thumbs_up: newValue }),
    });
  }

  async function handleGetSuggestions() {
    if (!suggestionAccount) { toast.error('Select an account'); return; }
    setLoadingSuggestions(true);
    try {
      const body: Record<string, any> = { account_id: suggestionAccount, period_days: 90 };
      if (productFocus) body.product_focus = productFocus;
      if (topicFocus) body.topic_focus = topicFocus;

      const res = await fetch('/api/linkedin/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      const { suggestions: sugs } = await res.json();
      setSuggestions(sugs || []);
    } catch {
      toast.error('Failed to generate suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  // Group insights by run
  const byRun: Record<string, LinkedInAiInsight[]> = {};
  for (const insight of insights) {
    if (!byRun[insight.run_id]) byRun[insight.run_id] = [];
    byRun[insight.run_id].push(insight);
  }
  const runIds = Object.keys(byRun).sort((a, b) => {
    const aDate = byRun[a][0].generated_at;
    const bDate = byRun[b][0].generated_at;
    return bDate.localeCompare(aDate);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#2323A3]" />
            AI Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Claude analyses your post performance and surfaces patterns
          </p>
        </div>

        {isEditor && (
          <div className="flex items-center gap-2">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate Insights'}
            </Button>
          </div>
        )}
      </div>

      {/* Post Suggestion panel */}
      {isEditor && (
        <Card className="border-[#2323A3]/30 bg-[#2323A3]/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#2323A3]" />
                <span className="font-semibold text-sm">Post Idea Generator</span>
                <Badge variant="outline" className="text-xs">Beta</Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowSuggestions(!showSuggestions)}>
                {showSuggestions ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>

          {showSuggestions && (
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Select value={suggestionAccount} onValueChange={setSuggestionAccount}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input
                  className="h-9 px-3 rounded-md border bg-background text-sm w-40"
                  placeholder="Product focus"
                  value={productFocus}
                  onChange={e => setProductFocus(e.target.value)}
                />
                <input
                  className="h-9 px-3 rounded-md border bg-background text-sm w-40"
                  placeholder="Topic focus"
                  value={topicFocus}
                  onChange={e => setTopicFocus(e.target.value)}
                />
                <Button onClick={handleGetSuggestions} disabled={loadingSuggestions} size="sm" className="gap-2">
                  {loadingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate 4 Ideas
                </Button>
              </div>

              {suggestions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {suggestions.map((sug) => (
                    <Card key={sug.id} className="bg-background">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">{sug.format}</Badge>
                          {sug.topic_tags.slice(0, 2).map(t => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">
                          {sug.post_text}
                        </p>
                        <p className="text-xs text-muted-foreground italic border-t pt-2">
                          {sug.rationale}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Insights list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : runIds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <Sparkles className="h-10 w-10 mx-auto opacity-30" />
          <p>No insights yet. Click "Generate Insights" to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {runIds.map((runId, runIdx) => {
            const runInsights = byRun[runId];
            const generatedAt = new Date(runInsights[0].generated_at);
            const periodStart = runInsights[0].period_start;
            const periodEnd = runInsights[0].period_end;

            return (
              <div key={runId}>
                {runIdx > 0 && <Separator className="mb-8" />}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {generatedAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {periodStart && periodEnd && (
                      <p className="text-xs text-muted-foreground">
                        Analysis period: {periodStart} → {periodEnd}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">{runInsights.length} insights</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {runInsights.map((insight) => {
                    const Icon = INSIGHT_ICONS[insight.insight_type] || Lightbulb;
                    return (
                      <div
                        key={insight.id}
                        className={cn('rounded-lg border p-4 space-y-2', INSIGHT_COLOURS[insight.insight_type])}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4 shrink-0', INSIGHT_ICON_COLOURS[insight.insight_type])} />
                            <Badge variant="outline" className="text-xs capitalize">
                              {insight.insight_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleThumbsFeedback(insight.id, true)}
                              className={cn(
                                'p-1 rounded hover:bg-black/5 transition-colors',
                                insight.thumbs_up === true && 'text-emerald-600'
                              )}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleThumbsFeedback(insight.id, false)}
                              className={cn(
                                'p-1 rounded hover:bg-black/5 transition-colors',
                                insight.thumbs_up === false && 'text-red-600'
                              )}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed">{insight.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
