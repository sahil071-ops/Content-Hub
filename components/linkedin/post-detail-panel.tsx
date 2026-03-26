'use client';

import { useState } from 'react';
import { X, ExternalLink, Edit2, Save, X as XIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountBadge } from './account-badge';
import { EngagementBadge } from './engagement-badge';
import { FormatBadge } from './format-badge';
import { toast } from 'sonner';
import type { LinkedInPost, LinkedInAccount } from '@/types/database';

interface PostDetailPanelProps {
  post: LinkedInPost;
  accounts: LinkedInAccount[];
  accountAvg?: number;
  onClose: () => void;
  onUpdated: (post: LinkedInPost) => void;
  onDeleted: () => void;
  isEditor: boolean;
}

const METRIC_FIELDS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'profile_visits', label: 'Profile Visits' },
  { key: 'follows_gained', label: 'Follows Gained' },
  { key: 'link_clicks', label: 'Link Clicks' },
] as const;

export function PostDetailPanel({ post, accounts, accountAvg, onClose, onUpdated, onDeleted, isEditor }: PostDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/linkedin/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onUpdated(data.post);
      setEditing(false);
      toast.success('Post updated');
    } catch (e) {
      toast.error(`Failed to save post: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/linkedin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      toast.success('Post deleted');
      onDeleted();
    } catch (e) {
      toast.error(`Failed to delete: ${(e as Error).message}`);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl bg-background shadow-xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-3">
            {editing ? (
              <Select
                value={draft.account_id}
                onValueChange={(val) => {
                  const acc = accounts.find((a) => a.id === val);
                  setDraft((d) => ({ ...d, account_id: val, account: acc ?? d.account }));
                }}
              >
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              post.account && <AccountBadge account={post.account} />
            )}
            <FormatBadge format={post.post_format} />
          </div>
          <div className="flex items-center gap-2">
            {isEditor && !editing && (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-muted-foreground">Delete?</span>
                    <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            {editing && (
              <>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />{saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDraft(post); setEditing(false); }}>
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Date + Engagement rate */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {new Date(post.post_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Engagement:</span>
              <EngagementBadge rate={post.engagement_rate} accountAvg={accountAvg} />
            </div>
          </div>

          {/* Post URL */}
          {post.post_url && (
            <a href={post.post_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline truncate">
              <ExternalLink className="h-3 w-3 shrink-0" />
              {post.post_url}
            </a>
          )}

          {/* Post text */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Post Text</p>
            {editing ? (
              <Textarea
                value={draft.post_text || ''}
                onChange={(e) => setDraft((d) => ({ ...d, post_text: e.target.value }))}
                rows={6}
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {post.post_text || <span className="text-muted-foreground italic">No text stored</span>}
              </p>
            )}
          </div>

          {/* Metrics grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Metrics</p>
            <div className="grid grid-cols-2 gap-2">
              {METRIC_FIELDS.map(({ key, label }) => (
                <div key={key} className="rounded-md border bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {editing ? (
                    <Input
                      type="number"
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value ? parseInt(e.target.value) : null }))}
                      className="h-7 text-sm mt-1"
                    />
                  ) : (
                    <p className="text-sm font-semibold mt-0.5">
                      {post[key] !== null && post[key] !== undefined ? post[key]!.toLocaleString() : '—'}
                    </p>
                  )}
                </div>
              ))}
              <div className="rounded-md border bg-[#2323A3]/5 p-2">
                <p className="text-xs text-muted-foreground">Engagement Rate</p>
                <div className="mt-0.5">
                  <EngagementBadge rate={post.engagement_rate} accountAvg={accountAvg} />
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {(post.topic_tags.length > 0 || post.product_tags.length > 0) && (
            <div className="space-y-2">
              {post.topic_tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {post.topic_tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                </div>
              )}
              {post.product_tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Products</p>
                  <div className="flex flex-wrap gap-1">
                    {post.product_tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Screenshot */}
          {post.screenshot_url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Analytics Screenshot</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.screenshot_url} alt="Analytics screenshot" className="rounded-md border w-full" />
            </div>
          )}

          {/* Linked content */}
          {post.linked_content && (
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Linked Content Asset</p>
              <p className="text-sm font-medium">{post.linked_content.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{post.linked_content.content_type}</p>
            </div>
          )}

          {/* AI extraction notes */}
          {post.extraction_notes && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">AI Extraction Notes</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{post.extraction_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
