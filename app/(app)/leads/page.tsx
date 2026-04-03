'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Loader2, ShieldAlert, Star, Users,
  ChevronDown, ChevronUp, Sparkles, ThumbsUp, ThumbsDown,
  Phone, Mail, Globe, Building2, Briefcase, MapPin,
  CheckCircle2, XCircle, TrendingUp, AlertTriangle, Linkedin, Calendar,
  ShieldCheck as VerifiedIcon, ShieldAlert as DisposableIcon, HelpCircle as UnknownEmailIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { computeQualityBreakdown } from '@/lib/crm/quality-score';
import type { Lead, LeadEnrichment } from '@/types/database';

type ViewTab = 'all' | 'clean' | 'spam' | 'high_value';

interface LeadStats {
  total: number;
  last_7d: number;
  last_30d: number;
  spam: number;
  high_value: number;
  sources: { source: string; count: number }[];
}

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [total, setTotal]       = useState(0);
  const [stats, setStats]       = useState<LeadStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<ViewTab>('all');
  const [search, setSearch]     = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, limit: '200' });
      if (search) params.set('q', search);
      const [leadsRes, meRes, statsRes] = await Promise.all([
        fetch(`/api/leads?${params}`),
        fetch('/api/me'),
        fetch('/api/leads/stats'),
      ]);
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(d.leads ?? []);
        setTotal(d.total ?? 0);
      }
      if (meRes.ok)   setUserRole((await meRes.json())?.role ?? '');
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [view, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function updateLead(updated: Lead) {
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
  }

  async function handleEnrich(lead: Lead) {
    setEnrichingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/enrich`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      const { lead: updated } = await res.json();
      updateLead(updated);
      setExpandedId(lead.id);
      toast.success('Lead enriched');
    } catch (e) {
      toast.error(`Enrichment failed: ${(e as Error).message}`);
    } finally {
      setEnrichingId(null);
    }
  }

  const isEditor = ['admin', 'marketing'].includes(userRole);
  const maxSource = stats?.sources[0]?.count ?? 1;

  return (
    <div className="p-4 md:p-6 space-y-5">
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

      {/* ── Stats panel ── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Arrival counts */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />Lead Arrivals
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Last 7d',  value: stats.last_7d },
                { label: 'Last 30d', value: stats.last_30d },
                { label: 'All time', value: stats.total },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xl font-bold">{value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spam / high-value split */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />Quality Split
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-red-500">{stats.spam.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Spam</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total ? Math.round(stats.spam / stats.total * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-500">{stats.high_value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">High-value</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total ? Math.round(stats.high_value / stats.total * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Source breakdown */}
          <div className="rounded-lg border bg-card p-4 space-y-2 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />Where leads come from <span className="font-normal">(90d)</span>
            </p>
            {stats.sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No source data yet</p>
            ) : (
              <div className="space-y-1.5">
                {stats.sources.map(({ source, count }) => (
                  <div key={source} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{source}</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#2323A3] rounded-full"
                        style={{ width: `${(count / maxSource) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Tabs value={view} onValueChange={v => setView(v as ViewTab)} className="flex-1">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clean">Clean</TabsTrigger>
            <TabsTrigger value="high_value" className="gap-1">
              <Star className="h-3 w-3" />High Value
            </TabsTrigger>
            <TabsTrigger value="spam" className="gap-1">
              <ShieldAlert className="h-3 w-3" />Spam
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* ── Lead list ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No leads found. Connect Zoho CRM in Admin → Zoho Setup to pull leads.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isExpanded={expandedId === lead.id}
              onToggle={() => setExpandedId(p => p === lead.id ? null : lead.id)}
              onUpdated={updateLead}
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'proton.me', 'zohomail.com', 'rediffmail.com', 'ymail.com', 'inbox.com',
  'mail.com', 'gmx.com', 'gmx.net',
]);

/** Returns the domain from an email only if it looks like a real company domain. */
function getCompanyDomain(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain || FREE_DOMAINS.has(domain)) return null;
  return domain;
}

/**
 * Returns a LinkedIn people-search URL when the lead has enough identity signals
 * to make the search meaningful (real name + company/domain, not spam).
 */
function getLinkedInSearchUrl(lead: Lead): string | null {
  if (lead.is_spam) return null;
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  if (name.length < 3) return null;                       // no real name
  const company = lead.company?.trim() || getCompanyDomain(lead.email)?.split('.')[0] || '';
  if (!company) return null;                              // need company context
  const q = [name, company].filter(Boolean).join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

// ── LeadCard ────────────────────────────────────────────────────────────────

function LeadCard({
  lead, isExpanded, onToggle, onUpdated, onEnrich, isEnriching, isEditor,
}: {
  lead: Lead;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdated: (l: Lead) => void;
  onEnrich: () => void;
  isEnriching: boolean;
  isEditor: boolean;
}) {
  const fullName      = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
  const quality       = computeQualityBreakdown(lead);
  const enrichment    = lead.enrichment as (LeadEnrichment & Record<string, unknown>) | null | undefined;
  const companyDomain = getCompanyDomain(lead.email);
  const linkedInUrl   = getLinkedInSearchUrl(lead);

  return (
    <div className={cn(
      'rounded-md border bg-card',
      lead.is_spam && 'border-red-200 dark:border-red-900/50',
      lead.is_high_value && !lead.is_spam && 'border-amber-200 dark:border-amber-800/50',
    )}>
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={onToggle}>
        <div className={cn(
          'h-2.5 w-2.5 rounded-full shrink-0',
          lead.is_spam      ? 'bg-red-500'    :
          lead.is_high_value ? 'bg-amber-400' : 'bg-emerald-400',
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm">{fullName}</span>
            {lead.is_spam && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Spam</Badge>}
            {lead.is_high_value && !lead.is_spam && (
              <Badge className="bg-amber-500 text-[10px] px-1.5 py-0">High Value</Badge>
            )}
            {enrichment && (
              <Badge className="bg-purple-600 text-[10px] px-1.5 py-0 gap-1">
                <Sparkles className="h-2.5 w-2.5" />Enriched
              </Badge>
            )}
            {!lead.spam_reviewed && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 hidden sm:flex">
                AI decision
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.company && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />{lead.company}
              </span>
            )}
            {lead.title && <span className="text-xs text-muted-foreground">{lead.title}</span>}
            {lead.email && (
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <Mail className="h-3 w-3" />{lead.email}
                {lead.email_deliverable === true && lead.email_disposable === false && (
                  <VerifiedIcon className="h-3 w-3 text-emerald-500" title="Email verified deliverable" />
                )}
                {lead.email_disposable === true && (
                  <DisposableIcon className="h-3 w-3 text-red-500" title="Disposable email" />
                )}
                {lead.email_deliverable === false && lead.email_disposable !== true && (
                  <UnknownEmailIcon className="h-3 w-3 text-amber-500" title="Email undeliverable" />
                )}
              </span>
            )}
          </div>
        </div>
        {/* Quality score pill */}
        {!lead.is_spam && (
          <span className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:block',
            quality.score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
            quality.score >= 35 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  'bg-muted text-muted-foreground',
          )}>
            Q {Math.round(quality.score)}
          </span>
        )}
        {lead.lead_source && (
          <Badge variant="outline" className="text-[10px] hidden md:flex">{lead.lead_source}</Badge>
        )}
        {isExpanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {isExpanded && (
        <div className="border-t p-4 space-y-5">

          {/* Contact details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Mail className="h-4 w-4 shrink-0" />{lead.email}
                {lead.email_deliverable === true && lead.email_disposable === false && (
                  <span className="text-xs text-emerald-500 font-medium flex items-center gap-0.5"><VerifiedIcon className="h-3 w-3" />Verified</span>
                )}
                {lead.email_disposable === true && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-0.5"><DisposableIcon className="h-3 w-3" />Disposable</span>
                )}
                {lead.email_deliverable === false && lead.email_disposable !== true && (
                  <span className="text-xs text-amber-500 font-medium flex items-center gap-0.5"><UnknownEmailIcon className="h-3 w-3" />Undeliverable</span>
                )}
              </a>
            )}
            {/* Company domain derived from email — opens company website */}
            {companyDomain && (
              <a href={`https://${companyDomain}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline">
                <Globe className="h-4 w-4 shrink-0" />{companyDomain}
              </a>
            )}
            {(lead.phone || lead.mobile) && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />{lead.phone || lead.mobile}
              </span>
            )}
            {lead.company && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />{lead.company}
              </span>
            )}
            {lead.title && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />{lead.title}
              </span>
            )}
            {lead.website && (
              <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Globe className="h-4 w-4 shrink-0" />{lead.website}
              </a>
            )}
            {lead.country && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />{lead.country}
              </span>
            )}
            {(lead as any).submitted_at && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                {new Date((lead as any).submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {(lead as any).date_estimated && (
                  <span className="text-xs text-amber-500 italic ml-1">(Date estimated)</span>
                )}
              </span>
            )}
            {/* LinkedIn people search — only for non-spam leads with name + company */}
            {linkedInUrl && (
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#0077b5] hover:underline">
                <Linkedin className="h-4 w-4 shrink-0" />Find on LinkedIn
              </a>
            )}
          </div>

          {/* ── Quality score breakdown ── */}
          <QualityBreakdownPanel quality={quality} isSpam={lead.is_spam} />

          {/* ── Spam reasons ── */}
          {lead.spam_reasons.length > 0 && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Spam signals detected (score {Math.round(lead.spam_score ?? 0)}/100)
              </p>
              <ul className="space-y-0.5">
                {lead.spam_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-400">• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {lead.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Note from Zoho</p>
              <p className="text-sm text-muted-foreground">{lead.description}</p>
            </div>
          )}

          {/* ── Enrichment panel ── */}
          {enrichment && <EnrichmentPanel enrichment={enrichment} />}

          {/* ── Actions: enrich ── */}
          {isEditor && !lead.is_spam && !enrichment && (
            <div>
              <Button
                size="sm" variant="outline" className="gap-2"
                onClick={onEnrich}
                disabled={isEnriching || lead.enrichment_status === 'pending'}
              >
                {isEnriching || lead.enrichment_status === 'pending'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5 text-purple-500" />}
                {lead.enrichment_status === 'pending' ? 'Enriching…' : 'Enrich with AI'}
              </Button>
              {lead.enrichment_status === 'failed' && (
                <span className="ml-2 text-xs text-destructive">Last enrichment failed — try again</span>
              )}
            </div>
          )}

          {/* ── Feedback / Training panels ── */}
          {isEditor && (
            <div className="space-y-3 pt-1 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Train the AI — your feedback improves future classifications
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FeedbackPanel
                  lead={lead}
                  feedbackType="spam"
                  currentDecision={lead.is_spam}
                  label={lead.is_spam ? 'Classified as spam' : 'Classified as legitimate'}
                  onUpdated={onUpdated}
                />
                <FeedbackPanel
                  lead={lead}
                  feedbackType="quality"
                  currentDecision={lead.is_high_value}
                  label={lead.is_high_value ? 'Classified as high-value' : 'Not classified as high-value'}
                  onUpdated={onUpdated}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quality breakdown panel ─────────────────────────────────────────────────

function QualityBreakdownPanel({
  quality, isSpam,
}: {
  quality: ReturnType<typeof computeQualityBreakdown>;
  isSpam: boolean;
}) {
  return (
    <div className={cn(
      'rounded-md p-3 space-y-2',
      isSpam
        ? 'bg-muted/40'
        : quality.is_high_value
          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40'
          : 'bg-muted/40',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Why {quality.is_high_value ? 'high-value' : `quality score is ${Math.round(quality.score)}/100`}
        </p>
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded-full',
          isSpam               ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
          quality.is_high_value ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                  'bg-muted text-muted-foreground',
        )}>
          {isSpam ? 'N/A (spam)' : `${Math.round(quality.score)} / 100`}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {quality.factors.map(f => (
          <div key={f.label} className="flex items-start gap-2">
            {f.met
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              : <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <span className={cn('text-xs', f.met ? 'text-foreground' : 'text-muted-foreground')}>
                {f.label}
              </span>
              {f.met && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">
                  +{f.earned}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feedback / training panel ────────────────────────────────────────────────

function FeedbackPanel({
  lead, feedbackType, currentDecision, label, onUpdated,
}: {
  lead: Lead;
  feedbackType: 'spam' | 'quality';
  currentDecision: boolean;
  label: string;
  onUpdated: (l: Lead) => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNote, setShowNote] = useState(false);

  async function submitFeedback(userDecision: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_type:     feedbackType,
          original_decision: currentDecision,
          user_decision:     userDecision,
          user_note:         note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { lead: updated } = await res.json();
      onUpdated(updated);
      setNote('');
      setShowNote(false);
      toast.success('Feedback saved — AI will use this on the next pull');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isSpamPanel    = feedbackType === 'spam';
  const panelTitle     = isSpamPanel ? 'Spam classification' : 'High-value classification';
  const thumbsUpLabel  = isSpamPanel ? 'Correct — is spam'       : 'Correct — is high-value';
  const thumbsDownLabel = isSpamPanel ? 'Wrong — not spam'       : 'Wrong — not high-value';

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{panelTitle}</p>
      <p className="text-xs">
        AI says: <span className={cn(
          'font-semibold',
          isSpamPanel
            ? currentDecision ? 'text-red-600' : 'text-emerald-600'
            : currentDecision ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          {currentDecision ? (isSpamPanel ? 'Spam' : 'High-value') : (isSpamPanel ? 'Legitimate' : 'Not high-value')}
        </span>
      </p>
      <div className="flex gap-2">
        <Button
          size="sm" variant="outline"
          className="flex-1 gap-1.5 text-xs h-7"
          onClick={() => { setShowNote(true); }}
          disabled={submitting}
          title={thumbsUpLabel}
        >
          <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
          Correct
        </Button>
        <Button
          size="sm" variant="outline"
          className="flex-1 gap-1.5 text-xs h-7"
          onClick={() => { setShowNote(true); }}
          disabled={submitting}
          title={thumbsDownLabel}
        >
          <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
          Wrong
        </Button>
      </div>

      {showNote && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional: explain why (e.g. 'Large contractor, uses personal email'). This trains future AI decisions."
            rows={2}
            className="text-xs resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm" className="flex-1 gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => submitFeedback(currentDecision)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              <ThumbsUp className="h-3 w-3" />Correct — confirm
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1 gap-1 text-xs h-7 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => submitFeedback(!currentDecision)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              <ThumbsDown className="h-3 w-3" />Wrong — override
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7"
              onClick={() => setShowNote(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Enrichment panel ─────────────────────────────────────────────────────────

function EnrichmentPanel({ enrichment }: { enrichment: LeadEnrichment & Record<string, unknown> }) {
  const dp = enrichment.deal_potential as 'low' | 'medium' | 'high' | null;
  const potentialColor = dp === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : dp === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="rounded-md border border-purple-200 dark:border-purple-800/50 bg-purple-50 dark:bg-purple-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">AI Sales Intelligence</p>
        {dp && (
          <Badge className={cn('text-[10px] ml-auto', potentialColor)}>
            {dp.charAt(0).toUpperCase() + dp.slice(1)} deal potential
          </Badge>
        )}
      </div>
      {enrichment.company_summary && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Company</p>
          <p className="text-sm">{enrichment.company_summary as string}</p>
        </div>
      )}
      {enrichment.likely_use_case && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Likely Use Case</p>
          <p className="text-sm">{enrichment.likely_use_case as string}</p>
        </div>
      )}
      {(enrichment.recommended_products as string[] | undefined)?.length ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recommended Products</p>
          <div className="flex flex-wrap gap-1.5">
            {(enrichment.recommended_products as string[]).map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
            ))}
          </div>
        </div>
      ) : null}
      {(enrichment.talking_points as string[] | undefined)?.length ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Talking Points</p>
          <ul className="space-y-1">
            {(enrichment.talking_points as string[]).map((tp, i) => (
              <li key={i} className="text-sm flex gap-1.5"><span className="text-muted-foreground shrink-0">•</span>{tp}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {enrichment.follow_up_suggestion && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Follow-up Suggestion</p>
          <p className="text-sm italic">{enrichment.follow_up_suggestion as string}</p>
        </div>
      )}
      {enrichment.notes && (
        <div className="rounded bg-background/60 p-2">
          <p className="text-xs text-muted-foreground">{enrichment.notes as string}</p>
        </div>
      )}
    </div>
  );
}
