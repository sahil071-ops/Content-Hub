'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Plus, Trash2, Loader2, Camera, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import type { LinkedInAccount, LinkedInPostFormat, LinkedInExtractedMetrics } from '@/types/database';
import { useEffect } from 'react';

const FORMAT_OPTIONS: LinkedInPostFormat[] = ['text', 'image', 'video', 'carousel', 'document', 'poll', 'other'];

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
  topic_tags: string;
  product_tags: string;
  screenshot_file?: File;
  screenshot_preview?: string;
  extracting?: boolean;
  extracted?: boolean;
  expanded?: boolean;
}

function emptyRow(): PostRow {
  return {
    id: Math.random().toString(36).slice(2),
    account_id: '',
    post_url: '',
    post_date: new Date().toISOString().split('T')[0],
    post_text: '',
    post_format: 'text',
    impressions: '',
    reactions: '',
    comments: '',
    shares: '',
    profile_visits: '',
    follows_gained: '',
    link_clicks: '',
    topic_tags: '',
    product_tags: '',
    expanded: true,
  };
}

export default function LinkedInAddPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Mode A — screenshot extraction
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

  // ── Mode A handlers ─────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleScreenshotUpload(file: File) {
    setModeARow(r => ({ ...r, screenshot_file: file, screenshot_preview: URL.createObjectURL(file), extracting: true }));

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
        impressions: metrics.impressions?.toString() ?? '',
        reactions: metrics.reactions?.toString() ?? '',
        comments: metrics.comments?.toString() ?? '',
        shares: metrics.shares?.toString() ?? '',
        profile_visits: metrics.profile_visits?.toString() ?? '',
        follows_gained: metrics.follows_gained?.toString() ?? '',
        link_clicks: metrics.link_clicks?.toString() ?? '',
        post_date: metrics.post_date ?? r.post_date,
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
      // If there's a screenshot file, upload to R2 first
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

      const body = {
        account_id: modeARow.account_id,
        post_url: modeARow.post_url || null,
        post_date: modeARow.post_date,
        post_text: modeARow.post_text || null,
        post_format: modeARow.post_format,
        status: 'published',
        impressions: modeARow.impressions ? parseInt(modeARow.impressions) : null,
        reactions: modeARow.reactions ? parseInt(modeARow.reactions) : null,
        comments: modeARow.comments ? parseInt(modeARow.comments) : null,
        shares: modeARow.shares ? parseInt(modeARow.shares) : null,
        profile_visits: modeARow.profile_visits ? parseInt(modeARow.profile_visits) : null,
        follows_gained: modeARow.follows_gained ? parseInt(modeARow.follows_gained) : null,
        link_clicks: modeARow.link_clicks ? parseInt(modeARow.link_clicks) : null,
        topic_tags: modeARow.topic_tags.split(',').map(t => t.trim()).filter(Boolean),
        product_tags: modeARow.product_tags.split(',').map(t => t.trim()).filter(Boolean),
        screenshot_url,
        extraction_status: modeARow.extracted ? 'ai_extracted' : 'manual',
      };

      const res = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Save failed');
      toast.success('Post saved');
      router.push('/linkedin');
    } catch {
      toast.error('Failed to save post');
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
      const posts = validRows.map(r => ({
        account_id: r.account_id,
        post_url: r.post_url || null,
        post_date: r.post_date,
        post_text: r.post_text || null,
        post_format: r.post_format,
        status: 'published',
        impressions: r.impressions ? parseInt(r.impressions) : null,
        reactions: r.reactions ? parseInt(r.reactions) : null,
        comments: r.comments ? parseInt(r.comments) : null,
        shares: r.shares ? parseInt(r.shares) : null,
        profile_visits: r.profile_visits ? parseInt(r.profile_visits) : null,
        follows_gained: r.follows_gained ? parseInt(r.follows_gained) : null,
        link_clicks: r.link_clicks ? parseInt(r.link_clicks) : null,
        topic_tags: r.topic_tags.split(',').map(t => t.trim()).filter(Boolean),
        product_tags: r.product_tags.split(',').map(t => t.trim()).filter(Boolean),
        extraction_status: 'manual' as const,
      }));

      const res = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posts),
      });

      if (!res.ok) throw new Error('Save failed');
      const { count } = await res.json();
      toast.success(`${count} post${count !== 1 ? 's' : ''} saved`);
      router.push('/linkedin');
    } catch {
      toast.error('Failed to save posts');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add LinkedIn Post</h1>
        <p className="text-sm text-muted-foreground">
          Use Mode A to extract metrics from a screenshot, or Mode B for manual bulk entry.
        </p>
      </div>

      <Tabs defaultValue="mode-a">
        <TabsList>
          <TabsTrigger value="mode-a" className="gap-2">
            <Camera className="h-4 w-4" />
            Mode A — Screenshot
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
              <CardTitle>Screenshot Extraction</CardTitle>
              <CardDescription>
                Upload a LinkedIn Analytics screenshot and Claude Vision will extract the metrics automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Account + date + format */}
              <div className="grid grid-cols-3 gap-3">
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
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={modeARow.post_format} onValueChange={v => setModeARow(r => ({ ...r, post_format: v as LinkedInPostFormat }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
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

              {/* Screenshot upload */}
              <div className="space-y-2">
                <Label>Analytics Screenshot</Label>
                {modeARow.screenshot_preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modeARow.screenshot_preview}
                      alt="Screenshot preview"
                      className="w-full max-h-64 object-contain rounded-md border"
                    />
                    {modeARow.extracting && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-md">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Extracting metrics…
                        </div>
                      </div>
                    )}
                    {modeARow.extracted && (
                      <Badge className="absolute top-2 right-2 bg-emerald-600">AI Extracted</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute bottom-2 right-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file?.type.startsWith('image/')) handleScreenshotUpload(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drop a screenshot here or click to browse
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshotUpload(f); }}
                />
              </div>

              {/* Extracted / manual metrics */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Metrics</p>
                <div className="grid grid-cols-4 gap-2">
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

              {/* Post text + tags */}
              <div className="space-y-1">
                <Label>Post Text</Label>
                <Textarea
                  value={modeARow.post_text}
                  onChange={e => setModeARow(r => ({ ...r, post_text: e.target.value }))}
                  rows={4}
                  placeholder="Paste the post text…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Topic Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                  <Input
                    value={modeARow.topic_tags}
                    onChange={e => setModeARow(r => ({ ...r, topic_tags: e.target.value }))}
                    placeholder="e.g. safety, switchgear"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Product Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                  <Input
                    value={modeARow.product_tags}
                    onChange={e => setModeARow(r => ({ ...r, product_tags: e.target.value }))}
                    placeholder="e.g. MCB, RCD"
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
          <div className="grid grid-cols-3 gap-2">
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select value={row.post_format} onValueChange={v => onChange({ post_format: v as LinkedInPostFormat })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map(f => <SelectItem key={f} value={f} className="capitalize text-xs">{f}</SelectItem>)}
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

          <div className="grid grid-cols-4 gap-2">
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Topic Tags</Label>
              <Input
                value={row.topic_tags}
                onChange={e => onChange({ topic_tags: e.target.value })}
                className="h-8 text-xs"
                placeholder="safety, switchgear"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Product Tags</Label>
              <Input
                value={row.product_tags}
                onChange={e => onChange({ product_tags: e.target.value })}
                className="h-8 text-xs"
                placeholder="MCB, RCD"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
