'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Loader2, ShieldAlert, Star, Users,
  ChevronDown, ChevronUp, Sparkles, CheckCircle2, XCircle,
  Phone, Mail, Globe, Building2, Briefcase, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types/database';

type ViewTab = 'all' | 'clean' | 'spam' | 'high_value';

const QUALITY_COLOR: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, limit: '200' });
      if (search) params.set('q', search);
      const [leadsRes, meRes] = await Promise.all([
        fetch(`/api/leads?${params}`),
        fetch('/api/me'),
      ]);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setUserRole(me?.role ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [view, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function handleSpamToggle(lead: Lead) {
    const newSpam = !lead.is_spam;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_spam: newSpam, spam_reviewed: true }),
      });
      if (!res.ok) throw new Error('Update failed');
      const { lead: updated } = await res.json();
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      toast.success(newSpam ? 'Marked as spam' : 'Marked as legitimate');
    } catch {
      toast.error('Failed to update lead');
    }
  }

  async function handleEnrich(lead: Lead) {
    setEnrichingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/enrich`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const { lead: updated } = await res.json();
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setExpandedId(lead.id);
      toast.success('Lead enriched successfully');
    } catch (e) {
      toast.error(`Enrichment failed: ${(e as Error).message}`);
    } finally {
      setEnrichingId(null);
    }
  }

  const isEditor = ['admin', 'marketing'].includes(userRole);

  const spamCount = leads.filter(l => l.is_spam).length;
  const highValueCount = leads.filter(l => l.is_high_value).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">CRM Leads</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} leads total</p>
        </div>
        <Button size="icon" variant="ghost" onClick={fetchLeads} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="text-lg font-bold leading-none">{total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
          <div>
            <p className="text-lg font-bold leading-none">{spamCount}</p>
            <p className="text-xs text-muted-foreground">Spam</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-lg font-bold leading-none">{highValueCount}</p>
            <p className="text-xs text-muted-foreground">High-value</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewTab)} className="flex-1">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clean">Clean</TabsTrigger>
            <TabsTrigger value="high_value" className="gap-1">
              <Star className="h-3 w-3" />
              High Value
            </TabsTrigger>
            <TabsTrigger value="spam" className="gap-1">
              <ShieldAlert className="h-3 w-3" />
              Spam
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No leads found. Connect Zoho CRM in Admin to pull leads.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isExpanded={expandedId === lead.id}
              onToggle={() => setExpandedId(prev => prev === lead.id ? null : lead.id)}
              onSpamToggle={() => handleSpamToggle(lead)}
              onEnrich={() => handleEnrich(lead)}
              isEnriching={enrichingId === lead.id}
              isEditor={isEditor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lead card component ────────────────────────────────────────────────────────

function LeadCard({
  lead, isExpanded, onToggle, onSpamToggle, onEnrich, isEnriching, isEditor,
}: {
  lead: Lead;
  isExpanded: boolean;
  onToggle: () => void;
  onSpamToggle: () => void;
  onEnrich: () => void;
  isEnriching: boolean;
  isEditor: boolean;
}) {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
  const dealPotential = (lead.enrichment as any)?.deal_potential as 'low' | 'medium' | 'high' | null;

  return (
    <div className={cn(
      'rounded-md border bg-card transition-shadow',
      lead.is_spam && 'border-red-200 dark:border-red-900/50 opacity-75',
      lead.is_high_value && !lead.is_spam && 'border-amber-200 dark:border-amber-800/50',
    )}>
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggle}
      >
        {/* Spam indicator dot */}
        <div className={cn(
          'h-2.5 w-2.5 rounded-full shrink-0',
          lead.is_spam ? 'bg-red-500' :
          lead.is_high_value ? 'bg-amber-400' :
          'bg-emerald-400',
        )} />

        {/* Name + company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{fullName}</span>
            {lead.is_spam && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Spam</Badge>
            )}
            {lead.is_high_value && !lead.is_spam && (
              <Badge className="bg-amber-500 text-[10px] px-1.5 py-0">High Value</Badge>
            )}
            {lead.enrichment_status === 'done' && (
              <Badge className="bg-purple-600 text-[10px] px-1.5 py-0 gap-1">
                <Sparkles className="h-2.5 w-2.5" />Enriched
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.company && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />{lead.company}
              </span>
            )}
            {lead.title && (
              <span className="text-xs text-muted-foreground">{lead.title}</span>
            )}
            {lead.email && (
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <Mail className="h-3 w-3" />{lead.email}
              </span>
            )}
          </div>
        </div>

        {/* Quality score */}
        {lead.quality_score !== null && !lead.is_spam && (
          <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:block">
            Q: {Math.round(lead.quality_score)}
          </span>
        )}

        {/* Lead source */}
        {lead.lead_source && (
          <Badge variant="outline" className="text-[10px] hidden md:flex">{lead.lead_source}</Badge>
        )}

        {isExpanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* Contact details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                {lead.email}
              </a>
            )}
            {(lead.phone || lead.mobile) && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                {lead.phone || lead.mobile}
              </span>
            )}
            {lead.company && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                {lead.company}
              </span>
            )}
            {lead.title && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />
                {lead.title}
              </span>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Globe className="h-4 w-4 shrink-0" />
                {lead.website}
              </a>
            )}
            {lead.country && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {lead.country}
              </span>
            )}
          </div>

          {/* Spam reasons */}
          {lead.spam_reasons.length > 0 && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                Spam signals (score: {Math.round(lead.spam_score ?? 0)}/100)
              </p>
              <ul className="space-y-0.5">
                {lead.spam_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-400">• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {lead.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Note</p>
              <p className="text-sm text-muted-foreground">{lead.description}</p>
            </div>
          )}

          {/* Enrichment */}
          {lead.enrichment_status === 'done' && lead.enrichment && (
            <EnrichmentPanel enrichment={lead.enrichment as any} dealPotential={dealPotential} />
          )}

          {/* Actions */}
          {isEditor && (
            <div className="flex items-center gap-2 pt-1 border-t flex-wrap">
              {!lead.is_spam && lead.is_high_value && lead.enrichment_status !== 'done' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={onEnrich}
                  disabled={isEnriching || lead.enrichment_status === 'pending'}
                >
                  {isEnriching || lead.enrichment_status === 'pending'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  }
                  Enrich with AI
                </Button>
              )}
              {!lead.is_spam && !lead.is_high_value && lead.enrichment_status !== 'done' && (
                <Button size="sm" variant="outline" className="gap-2" onClick={onEnrich} disabled={isEnriching}>
                  {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Enrich
                </Button>
              )}

              {lead.is_spam ? (
                <Button size="sm" variant="outline" className="gap-2 text-emerald-600" onClick={onSpamToggle}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark as Legitimate
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={onSpamToggle}>
                  <XCircle className="h-3.5 w-3.5" />
                  Mark as Spam
                </Button>
              )}

              {!lead.spam_reviewed && lead.is_spam && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">AI decision — not reviewed</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Enrichment panel ───────────────────────────────────────────────────────────

function EnrichmentPanel({
  enrichment, dealPotential,
}: {
  enrichment: {
    company_summary?: string;
    likely_use_case?: string;
    recommended_products?: string[];
    talking_points?: string[];
    follow_up_suggestion?: string;
    notes?: string;
    deal_potential?: 'low' | 'medium' | 'high';
  };
  dealPotential: 'low' | 'medium' | 'high' | null;
}) {
  const dp = dealPotential ?? enrichment.deal_potential;
  return (
    <div className="rounded-md border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">AI Enrichment</p>
        {dp && (
          <Badge className={cn('text-[10px] ml-auto', QUALITY_COLOR[dp])}>
            {dp.charAt(0).toUpperCase() + dp.slice(1)} potential
          </Badge>
        )}
      </div>

      {enrichment.company_summary && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Company</p>
          <p className="text-sm">{enrichment.company_summary}</p>
        </div>
      )}
      {enrichment.likely_use_case && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Likely Use Case</p>
          <p className="text-sm">{enrichment.likely_use_case}</p>
        </div>
      )}
      {enrichment.recommended_products && enrichment.recommended_products.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recommended Products</p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.recommended_products.map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
            ))}
          </div>
        </div>
      )}
      {enrichment.talking_points && enrichment.talking_points.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Talking Points</p>
          <ul className="space-y-1">
            {enrichment.talking_points.map((tp, i) => (
              <li key={i} className="text-sm flex gap-1.5"><span className="text-muted-foreground">•</span>{tp}</li>
            ))}
          </ul>
        </div>
      )}
      {enrichment.follow_up_suggestion && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Follow-up</p>
          <p className="text-sm italic">{enrichment.follow_up_suggestion}</p>
        </div>
      )}
      {enrichment.notes && (
        <div className="rounded bg-background/60 p-2">
          <p className="text-xs text-muted-foreground">{enrichment.notes}</p>
        </div>
      )}
    </div>
  );
}
