'use client';

import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, List, Filter, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AccountBadge } from '@/components/linkedin/account-badge';
import { EngagementBadge } from '@/components/linkedin/engagement-badge';
import { FormatBadge } from '@/components/linkedin/format-badge';
import { PostDetailPanel } from '@/components/linkedin/post-detail-panel';
import { cn } from '@/lib/utils';
import type { LinkedInPost, LinkedInAccount, LinkedInPostFormat } from '@/types/database';

const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All types' },
  { value: 'text',      label: 'Text' },
  { value: 'image',     label: 'Photo / Image' },
  { value: 'video',     label: 'Video' },
  { value: 'carousel',  label: 'Carousel' },
  { value: 'document',  label: 'Document' },
  { value: 'poll',      label: 'Poll' },
  { value: 'other',     label: 'Other' },
];

export default function LinkedInLibraryPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [accountAvgs, setAccountAvgs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null);
  const [isEditor, setIsEditor] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [minEngagement, setMinEngagement] = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'published' });
      if (accountFilter !== 'all') params.set('account_id', accountFilter);
      if (formatFilter !== 'all') params.set('format', formatFilter);
      if (minEngagement) params.set('min_engagement', minEngagement);

      const [postsRes, accountsRes, meRes] = await Promise.all([
        fetch(`/api/linkedin/posts?${params}`),
        fetch('/api/linkedin/accounts'),
        fetch('/api/me'),
      ]);

      if (postsRes.ok) {
        const { posts: data } = await postsRes.json();
        setPosts(data || []);

        // Compute per-account average engagement
        const avgs: Record<string, number[]> = {};
        for (const p of data || []) {
          if (p.engagement_rate !== null) {
            if (!avgs[p.account_id]) avgs[p.account_id] = [];
            avgs[p.account_id].push(p.engagement_rate);
          }
        }
        const computed: Record<string, number> = {};
        for (const [id, rates] of Object.entries(avgs)) {
          computed[id] = rates.reduce((a, b) => a + b, 0) / rates.length;
        }
        setAccountAvgs(computed);
      }
      if (accountsRes.ok) {
        const { accounts: accs } = await accountsRes.json();
        setAccounts(accs || []);
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setIsEditor(['admin', 'marketing'].includes(me?.role));
      }
    } finally {
      setLoading(false);
    }
  }, [accountFilter, formatFilter, minEngagement]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filtered = posts.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.post_text?.toLowerCase().includes(q) ||
      p.account?.name?.toLowerCase().includes(q) ||
      p.topic_tags.some((t) => t.toLowerCase().includes(q)) ||
      p.product_tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  function handleUpdated(updated: LinkedInPost) {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } : p));
    setSelectedPost(updated);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LinkedIn Posts</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} posts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            size="icon"
            variant={view === 'table' ? 'default' : 'ghost'}
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={view === 'card' ? 'default' : 'ghost'}
            onClick={() => setView('card')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts, accounts, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-full"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="Min eng %"
              value={minEngagement}
              onChange={(e) => setMinEngagement(e.target.value)}
              className="w-24"
              type="number"
              min="0"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No posts found.</p>
        </div>
      ) : view === 'table' ? (
        <TableView
          posts={filtered}
          accountAvgs={accountAvgs}
          onSelect={setSelectedPost}
        />
      ) : (
        <CardView
          posts={filtered}
          accountAvgs={accountAvgs}
          onSelect={setSelectedPost}
        />
      )}

      {/* Detail panel */}
      {selectedPost && (
        <PostDetailPanel
          post={selectedPost}
          accountAvg={accountAvgs[selectedPost.account_id]}
          onClose={() => setSelectedPost(null)}
          onUpdated={handleUpdated}
          isEditor={isEditor}
        />
      )}
    </div>
  );
}

// ── Table view ──────────────────────────────────────────────────
function TableView({
  posts,
  accountAvgs,
  onSelect,
}: {
  posts: LinkedInPost[];
  accountAvgs: Record<string, number>;
  onSelect: (p: LinkedInPost) => void;
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Post</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Impressions</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Reactions</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Comments</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Shares</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Eng. Rate</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-b hover:bg-muted/20 cursor-pointer"
              onClick={() => onSelect(post)}
            >
              <td className="px-3 py-2">
                {post.account && <AccountBadge account={post.account} size="sm" />}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {new Date(post.post_date + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </td>
              <td className="px-3 py-2 max-w-xs">
                <p className="truncate text-sm">{post.post_text || <span className="italic text-muted-foreground">No text</span>}</p>
                {(post.topic_tags.length > 0 || post.product_tags.length > 0) && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {[...post.topic_tags, ...post.product_tags].slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">{t}</Badge>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 hidden sm:table-cell">
                <FormatBadge format={post.post_format} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                {post.impressions?.toLocaleString() ?? '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{post.reactions ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{post.comments ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">{post.shares ?? '—'}</td>
              <td className="px-3 py-2 text-right">
                <EngagementBadge
                  rate={post.engagement_rate}
                  accountAvg={accountAvgs[post.account_id]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Card view ───────────────────────────────────────────────────
function CardView({
  posts,
  accountAvgs,
  onSelect,
}: {
  posts: LinkedInPost[];
  accountAvgs: Record<string, number>;
  onSelect: (p: LinkedInPost) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="rounded-lg border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow space-y-3"
          onClick={() => onSelect(post)}
        >
          {/* Account + format */}
          <div className="flex items-center justify-between">
            {post.account && <AccountBadge account={post.account} size="sm" />}
            <FormatBadge format={post.post_format} />
          </div>

          {/* Date */}
          <p className="text-xs text-muted-foreground">
            {new Date(post.post_date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>

          {/* Text preview */}
          <p className="text-sm line-clamp-3 leading-relaxed">
            {post.post_text || <span className="italic text-muted-foreground">No text stored</span>}
          </p>

          {/* Metrics row */}
          <div className="flex items-center justify-between pt-1 border-t">
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{post.impressions?.toLocaleString() ?? '—'} imp</span>
              <span>{post.reactions ?? '—'} react</span>
              <span>{post.comments ?? '—'} cmts</span>
            </div>
            <EngagementBadge
              rate={post.engagement_rate}
              accountAvg={accountAvgs[post.account_id]}
              className="text-xs"
            />
          </div>

          {/* Tags */}
          {(post.topic_tags.length > 0 || post.product_tags.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {[...post.topic_tags, ...post.product_tags].slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
