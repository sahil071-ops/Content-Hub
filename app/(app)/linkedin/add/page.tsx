'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Plus, Trash2, Loader2, Camera, Edit3, ChevronDown, ChevronUp, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TagInput } from '@/components/ui/tag-input';
import { toast } from 'sonner';
import type { LinkedInAccount, LinkedInPostFormat, LinkedInExtractedMetrics } from '@/types/database';

const FORMAT_OPTIONS: { value: LinkedInPostFormat; label: string }[] = [
  { value: 'text',      label: 'Text' },
  { value: 'image',     label: 'Photo / Image' },
  { value: 'video',     label: 'Video' },
  { value: 'carousel',  label: 'Carousel' },
  { value: 'document',  label: 'Document' },
  { value: 'poll',      label: 'Poll' },
  { value: 'other',     label: 'Other' },
];

function getDateWarning(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  if (d > now) return 'Post date is in the future — please verify.';
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  if (d < threeYearsAgo) return 'Post date is more than 3 years ago — please verify.';
  return null;
}

interface PostRow {
  id: string;
  account_id: string;
  post_url: string;
  post_date: string;
  post_text: string;
  post_format: LinkedInPostFormat;
  impressions: string;
  reactions: string;
  comments: string;
  shares: string;
  profile_visits: string;
  follows_gained: string;
  link_clicks: string;
  topic_tags: string[];
  product_tags: string[];
  screenshot_file?: File;
  screenshot_preview?: string;
  extracting?: boolean;
  extracted?: boolean;
  extraction_status?: 'manual' | 'ai_extracted' | 'ai_partial';
  expanded?: boolean;
}

function emptyRow(): PostRow {
  return {
    id: Math.random().toString(36).slice(2),
    account_id: '',
    post_url: '',
    post_date: '',
    post_text: '',
    post_format: 'text',
    impressions: '',
    reactions: '',
    comments: '',
    shares: '',
    profile_visits: '',
    follows_gained: '',
    link_clicks: '',
    topic_tags: [],
    product_tags: [],
    extraction_status: 'manual',
    expanded: true,
  };
}

function rowToPayload(r: PostRow, overrides: Partial<PostRow> = {}) {
  const merged = { ...r, ...overrides };
  return {
    account_id: merged.account_id,
    post_url: merged.post_url || null,
    post_date: merged.post_date,
    post_text: merged.post_text || null,
    post_format: merged.post_format,
    status: 'published',
    impressions: merged.impressions ? parseInt(merged.impressions) : null,
    reactions: merged.reactions ? parseInt(merged.reactions) : null,
    comments: merged.comments ? parseInt(merged.comments) : null,
    shares: merged.shares ? parseInt(merged.shares) : null,
    profile_visits: merged.profile_visits ? parseInt(merged.profile_visits) : null,
    follows_gained: merged.follows_gained ? parseInt(merged.follows_gained) : null,
    link_clicks: merged.link_clicks ? parseInt(merged.link_clicks) : null,
    topic_tags: merged.topic_tags,
    product_tags: merged.product_tags,
    extraction_status: merged.extraction_status ?? 'manual',
  };
}

export default function LinkedInAddPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Mode A — screenshot / XLSX import
  const [modeARow, setModeARow] = useState<PostRow>(emptyRow());

  // Mode B — manual bulk entry
  const [bulkRows, setBulkRows] = useState<PostRow[]>([emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()]);

  useEffect(() => {
    fetch('/api/linkedin/accounts').then(r => r.json()).then(({ accounts: accs }) => {
      setAccounts(accs || []);
      const defaultId = accs?.[0]?.id || '';
      setModeARow(r => ({ ...r, account_id: defaultId }));
      setBulkRows(rows => rows.map(row => ({ ...row, account_id: defaultId })));
    });
  }, []);

  // ── Account detection from filename ─────────────────────────
  function detectAccountFromFilename(filename: string): string {
    // Strip extension, take first segment before _ or -
    const base = filename.replace(/\.[^/.]+$/, '');
    const segment = base.split(/[_\-\s]/)[0];
    // Split CamelCase: "SahilKhandwala" → "Sahil Khandwala"
    const normalized = segment
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .trim();
    const match = accounts.find((a) => {
      const name = a.name.toLowerCase();
      return name === normalized || name.replace(/\s+/g, '') === normalized.replace(/\s+/g, '');
    });
    return match?.id || '';
  }

  // ── Mode A handlers ─────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  async function handleXlsxUpload(file: File) {
    const detectedId = detectAccountFromFilename(file.name);
    setModeARow(r => ({ ...r, extracting: true, ...(detectedId ? { account_id: detectedId } : {}) }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/linkedin/parse-xlsx', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to parse XLSX');
      const { metrics, demographics } = await res.json() as {
        metrics: {
          post_url: string | null;
          post_date: string | null;
          impressions: number | null;
          reactions: number | null;
          comments: number | null;
          shares: number | null;
          profile_visits: number | null;
          follows_gained: number | null;
          members_reached: number | null;
          saves: number | null;
          sends: number | null;
        };
        demographics: { category: string; value: string; pct: string }[];
      };

      const extraNotes = [
        metrics.members_reached != null && `Members reached: ${metrics.members_reached}`,
        metrics.saves != null && `Saves: ${metrics.saves}`,
        metrics.sends != null && `Sends: ${metrics.sends}`,
        demographics.length > 0 && `Top demographics: ${demographics.slice(0, 5).map(d => `${d.category} — ${d.value} (${d.pct})`).join(', ')}`,
      ].filter(Boolean).join('\n');

      setModeARow(r => ({
        ...r,
        extracting: false,
        extracted: true,
        extraction_status: 'manual', // XLSX is not AI — it's exact data from LinkedIn
        post_url:       metrics.post_url ?? r.post_url,
        post_date:      metrics.post_date ?? r.post_date,
        impressions:    metrics.impressions?.toString() ?? r.impressions,
        reactions:      metrics.reactions?.toString() ?? r.reactions,
        comments:       metrics.comments?.toString() ?? r.comments,
        shares:         metrics.shares?.toString() ?? r.shares,
        profile_visits: metrics.profile_visits?.toString() ?? r.profile_visits,
        follows_gained: metrics.follows_gained?.toString() ?? r.follows_gained,
      }));

      toast.success(`Metrics loaded from XLSX${extraNotes ? ' — extra data logged to console' : ''}`);
      if (extraNotes) console.info('LinkedIn XLSX extra data:', extraNotes);
    } catch (e) {
      setModeARow(r => ({ ...r, extracting: false }));
      toast.error('Could not read XLSX file');
    }
  }

  async function handleScreenshotUpload(file: File) {
    const detectedId = detectAccountFromFilename(file.name);
    setModeARow(r => ({ ...r, screenshot_file: file, screenshot_preview: URL.createObjectURL(file), extracting: true, ...(detectedId ? { account_id: detectedId } : {}) }));

    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      const res = await fetch('/api/linkedin/extract', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Extraction failed');
      const { metrics, extraction_status, extraction_notes } = await res.json() as {
        metrics: LinkedInExtractedMetrics;
        extraction_status: string;
        extraction_notes: string;
      };

      setModeARow(r => ({
        ...r,
        extracting: false,
        extracted: true,
        extraction_status: (extraction_status as 'ai_extracted' | 'ai_partial') ?? 'ai_extracted',
        impressions:    metrics.impressions?.toString() ?? '',
        reactions:      metrics.reactions?.toString() ?? '',
        comments:       metrics.comments?.toString() ?? '',
        shares:         metrics.shares?.toString() ?? '',
        profile_visits: metrics.profile_visits?.toString() ?? '',
        follows_gained: metrics.follows_gained?.toString() ?? '',
        link_clicks:    metrics.link_clicks?.toString() ?? '',
        post_date:      metrics.post_date ?? r.post_date,
      }));

      if (extraction_status === 'ai_partial') {
        toast.warning('Partial extraction — please verify the numbers');
      } else {
        toast.success('Metrics extracted from screenshot');
      }
    } catch {
      setModeARow(r => ({ ...r, extracting: false }));
      toast.error('Could not extract metrics from screenshot');
    }
  }

  async function handleModeASubmit() {
    if (!modeARow.account_id) { toast.error('Select an account'); return; }
    if (!modeARow.post_date) { toast.error('Enter post date'); return; }

    setSubmitting(true);
    try {
      // Upload screenshot to R2 if present
      let screenshot_url: string | null = null;
      if (modeARow.screenshot_file) {
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: modeARow.screenshot_file.name,
            content_type_mime: modeARow.screenshot_file.type,
            content_type: 'image',
          }),
        });
        if (presignRes.ok) {
          const { upload_url, public_url } = await presignRes.json();
          await fetch(upload_url, {
            method: 'PUT',
            body: modeARow.screenshot_file,
            headers: { 'Content-Type': modeARow.screenshot_file.type },
          });
          screenshot_url = public_url;
        }
      }

      const body = { ...rowToPayload(modeARow), screenshot_url };

      const res = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as any)?.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      toast.success('Post saved');
      router.push('/linkedin');
    } catch (e) {
      toast.error(`Failed to save post: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Bulk mode handlers ──────────────────────────────────────
  function updateBulkRow(id: string, updates: Partial<PostRow>) {
    setBulkRows(rows => rows.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function addBulkRow() {
    const defaultId = accounts[0]?.id || '';
    setBulkRows(rows => [...rows, { ...emptyRow(), account_id: defaultId }]);
  }

  function removeBulkRow(id: string) {
    setBulkRows(rows => rows.filter(r => r.id !== id));
  }

  async function handleBulkSubmit() {
    const validRows = bulkRows.filter(r => r.account_id && r.post_date);
    if (validRows.length === 0) { toast.error('At least one row needs an account and date'); return; }

    setSubmitting(true);
    try {
      const posts = validRows.map(r => rowToPayload(r));

      const res = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posts),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as any)?.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json();
      const count = data.posts?.length ?? validRows.length;
      toast.success(`${count} post${count !== 1 ? 's' : ''} saved`);
      router.push('/linkedin');
    } catch (e) {
      toast.error(`Failed to save posts: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add LinkedIn Post</h1>
        <p className="text-sm text-muted-foreground">
          Mode A: import from LinkedIn's PostAnalytics XLSX or a screenshot. Mode B: manual bulk entry.
        </p>
      </div>

      <Tabs defaultValue="mode-a">
        <TabsList>
          <TabsTrigger value="mode-a" className="gap-2">
            <Upload className="h-4 w-4" />
            Mode A — Import
          </TabsTrigger>
          <TabsTrigger value="mode-b" className="gap-2">
            <Edit3 className="h-4 w-4" />
            Mode B — Manual Bulk
          </TabsTrigger>
        </TabsList>

        {/* ── Mode A ── */}
        <TabsContent value="mode-a" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import from LinkedIn</CardTitle>
              <CardDescription>
                Upload the LinkedIn PostAnalytics XLSX export for exact numbers, or upload a screenshot for Claude Vision extraction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ── XLSX / screenshot import strip ── */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 h-10 border-dashed"
                  onClick={() => xlsxInputRef.current?.click()}
                  disabled={modeARow.extracting}
                >
                  {modeARow.extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4 text-emerald-600" />}
                  <span className="text-sm">Upload PostAnalytics XLSX</span>
                  {modeARow.extracted && modeARow.extraction_status === 'manual' && (
                    <Badge className="bg-emerald-600 text-xs ml-auto">Loaded</Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 h-10 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={modeARow.extracting}
                >
                  {modeARow.extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-blue-600" />}
                  <span className="text-sm">Upload Screenshot</span>
                  {modeARow.screenshot_preview && !modeARow.extracted && (
                    <Badge variant="outline" className="text-xs ml-auto">Ready</Badge>
                  )}
                  {modeARow.extracted && modeARow.extraction_status !== 'manual' && (
                    <Badge className="bg-blue-600 text-xs ml-auto">AI Extracted</Badge>
                  )}
                </Button>
                <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleXlsxUpload(f); e.target.value = ''; }} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshotUpload(f); }} />
              </div>

              {/* Screenshot preview */}
              {modeARow.screenshot_preview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={modeARow.screenshot_preview} alt="Screenshot preview"
                    className="w-full max-h-48 object-contain rounded-md border" />
                  {modeARow.extracting && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-md">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />Extracting…
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Account + date + content type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Account *</Label>
                  <Select value={modeARow.account_id} onValueChange={v => setModeARow(r => ({ ...r, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Post Date *</Label>
                  <Input
                    type="date"
                    value={modeARow.post_date}
                    onChange={e => setModeARow(r => ({ ...r, post_date: e.target.value }))}
                  />
                  {modeARow.post_date && (() => {
                    const warn = getDateWarning(modeARow.post_date);
                    return warn ? <p className="text-xs text-amber-500">{warn}</p> : null;
                  })()}
                </div>
                <div className="space-y-1">
                  <Label>Content Type</Label>
                  <Select value={modeARow.post_format} onValueChange={v => setModeARow(r => ({ ...r, post_format: v as LinkedInPostFormat }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Post URL */}
              <div className="space-y-1">
                <Label>Post URL</Label>
                <Input
                  placeholder="https://www.linkedin.com/posts/..."
                  value={modeARow.post_url}
                  onChange={e => setModeARow(r => ({ ...r, post_url: e.target.value }))}
                />
              </div>

              {/* Metrics */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Metrics</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'impressions', label: 'Impressions' },
                    { key: 'reactions', label: 'Reactions' },
                    { key: 'comments', label: 'Comments' },
                    { key: 'shares', label: 'Shares' },
                    { key: 'profile_visits', label: 'Profile Visits' },
                    { key: 'follows_gained', label: 'Follows Gained' },
                    { key: 'link_clicks', label: 'Link Clicks' },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        value={(modeARow as any)[key]}
                        onChange={e => setModeARow(r => ({ ...r, [key]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Post text */}
              <div className="space-y-1">
                <Label>Post Text</Label>
                <Textarea
                  value={modeARow.post_text}
                  onChange={e => setModeARow(r => ({ ...r, post_text: e.target.value }))}
                  rows={4}
                  placeholder="Paste the post text…"
                />
              </div>

              {/* Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Topic Tags</Label>
                  <TagInput
                    types={['topic']}
                    value={modeARow.topic_tags}
                    onChange={tags => setModeARow(r => ({ ...r, topic_tags: tags }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Product Tags</Label>
                  <TagInput
                    types={['product']}
                    value={modeARow.product_tags}
                    onChange={tags => setModeARow(r => ({ ...r, product_tags: tags }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleModeASubmit} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Mode B ── */}
        <TabsContent value="mode-b" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Manual Entry</CardTitle>
              <CardDescription>
                Enter multiple posts at once. Click a row to expand and fill in all details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bulkRows.map((row, idx) => (
                <BulkPostRow
                  key={row.id}
                  row={row}
                  idx={idx}
                  accounts={accounts}
                  onChange={(updates) => updateBulkRow(row.id, updates)}
                  onRemove={() => removeBulkRow(row.id)}
                />
              ))}

              <Button variant="outline" className="w-full gap-2" onClick={addBulkRow}>
                <Plus className="h-4 w-4" />
                Add another row
              </Button>

              <div className="flex justify-end pt-2">
                <Button onClick={handleBulkSubmit} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <FileText className="h-4 w-4" />
                  Save {bulkRows.filter(r => r.account_id && r.post_date).length} Post{bulkRows.filter(r => r.account_id && r.post_date).length !== 1 ? 's' : ''}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Bulk row component ──────────────────────────────────────────
function BulkPostRow({
  row,
  idx,
  accounts,
  onChange,
  onRemove,
}: {
  row: PostRow;
  idx: number;
  accounts: LinkedInAccount[];
  onChange: (updates: Partial<PostRow>) => void;
  onRemove: () => void;
}) {
  const isValid = row.account_id && row.post_date;

  return (
    <div className={`rounded-md border ${isValid ? 'border-border' : 'border-dashed border-muted-foreground/30'}`}>
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => onChange({ expanded: !row.expanded })}
      >
        <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}</span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {row.account_id && accounts.find(a => a.id === row.account_id) && (
            <span className="text-xs font-medium">{accounts.find(a => a.id === row.account_id)?.name}</span>
          )}
          {row.post_date && (
            <span className="text-xs text-muted-foreground">{row.post_date}</span>
          )}
          {row.post_text && (
            <span className="text-xs text-muted-foreground truncate">{row.post_text.slice(0, 60)}…</span>
          )}
          {!row.account_id && !row.post_date && (
            <span className="text-xs text-muted-foreground italic">Empty row — click to fill</span>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        {row.expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded form */}
      {row.expanded && (
        <div className="border-t p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Account *</Label>
              <Select value={row.account_id} onValueChange={v => onChange({ account_id: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={row.post_date}
                onChange={e => onChange({ post_date: e.target.value })}
                className="h-8 text-xs"
              />
              {row.post_date && getDateWarning(row.post_date) && (
                <p className="text-[10px] text-amber-500">{getDateWarning(row.post_date)}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content Type</Label>
              <Select value={row.post_format} onValueChange={v => onChange({ post_format: v as LinkedInPostFormat })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Post URL</Label>
            <Input
              value={row.post_url}
              onChange={e => onChange({ post_url: e.target.value })}
              className="h-8 text-xs"
              placeholder="https://linkedin.com/posts/..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'impressions', label: 'Impressions' },
              { key: 'reactions', label: 'Reactions' },
              { key: 'comments', label: 'Comments' },
              { key: 'shares', label: 'Shares' },
              { key: 'profile_visits', label: 'Profile Visits' },
              { key: 'follows_gained', label: 'Follows' },
              { key: 'link_clicks', label: 'Link Clicks' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px]">{label}</Label>
                <Input
                  type="number"
                  value={(row as any)[key]}
                  onChange={e => onChange({ [key]: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Post Text</Label>
            <Textarea
              value={row.post_text}
              onChange={e => onChange({ post_text: e.target.value })}
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Topic Tags</Label>
              <TagInput
                types={['topic']}
                value={row.topic_tags}
                onChange={tags => onChange({ topic_tags: tags })}
                size="sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Product Tags</Label>
              <TagInput
                types={['product']}
                value={row.product_tags}
                onChange={tags => onChange({ product_tags: tags })}
                size="sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
