'use client';

import { useState, useEffect } from 'react';
import { Plug, RefreshCw, Trash2, Loader2, CheckCircle2, AlertCircle, Users, ShieldAlert, Star, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface ConnectionStatus {
  connection: {
    id: string;
    data_center: string;
    zoho_user_email: string | null;
    connected_at: string;
    last_pull_at: string | null;
  } | null;
  lead_count: number;
}

interface PullResult {
  fetched: number;
  new: number;
  spam: number;
  high_value: number;
  errors: string[];
}

function ZohoAdminContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [dataCenter, setDataCenter] = useState('com');
  const [lastPullResult, setLastPullResult] = useState<PullResult | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');
    if (error) toast.error(`Zoho connection failed: ${decodeURIComponent(error)}`);
    if (connected) {
      toast.success('Zoho CRM connected successfully');
      // Clear query params
      window.history.replaceState({}, '', '/admin/zoho');
    }
    loadStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/zoho/status');
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    window.location.href = `/api/zoho/auth?dc=${dataCenter}`;
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Zoho CRM? Existing leads will be preserved.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/zoho/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success('Zoho CRM disconnected');
      await loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handlePull() {
    setPulling(true);
    setLastPullResult(null);
    try {
      const since = status?.connection?.last_pull_at ?? undefined;
      const res = await fetch('/api/zoho/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Pull failed');
      }
      const result: PullResult = await res.json();
      setLastPullResult(result);
      toast.success(`Pulled ${result.fetched} leads — ${result.spam} spam, ${result.high_value} high-value`);
      await loadStatus();
    } catch (e) {
      toast.error(`Pull failed: ${(e as Error).message}`);
    } finally {
      setPulling(false);
    }
  }

  const isConnected = !!status?.connection;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zoho CRM Integration</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Zoho CRM account to pull leads, auto-detect spam, and enrich high-value contacts.
        </p>
      </div>

      {/* Connection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            One Zoho CRM account can be connected at a time. OAuth tokens are stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection…
            </div>
          ) : isConnected ? (
            <>
              <div className="flex items-start gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Connected</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Account: <strong>{status.connection!.zoho_user_email ?? '—'}</strong>
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Data center: <strong>.{status.connection!.data_center}</strong> ·
                    Connected {new Date(status.connection!.connected_at).toLocaleDateString()}
                  </p>
                  {status.connection!.last_pull_at && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Last pull: {new Date(status.connection!.last_pull_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handlePull} disabled={pulling} className="gap-2">
                  {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pulling ? 'Pulling…' : 'Pull Leads Now'}
                </Button>
                <Button variant="outline" onClick={loadStatus} disabled={loading || pulling} size="icon">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive ml-auto gap-2"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-dashed">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">No Zoho CRM account connected.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Zoho Data Center</Label>
                  <Select value={dataCenter} onValueChange={setDataCenter}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="com">United States (.com)</SelectItem>
                      <SelectItem value="eu">Europe (.eu)</SelectItem>
                      <SelectItem value="in">India (.in)</SelectItem>
                      <SelectItem value="au">Australia (.com.au)</SelectItem>
                      <SelectItem value="jp">Japan (.jp)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Match the data center where your Zoho account is hosted.
                  </p>
                </div>

                <Button onClick={handleConnect} className="gap-2">
                  <Plug className="h-4 w-4" />
                  Connect Zoho CRM
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats card */}
      {isConnected && status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{status.lead_count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </CardContent>
          </Card>
          {lastPullResult && (
            <>
              <Card>
                <CardContent className="pt-5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{lastPullResult.spam}</p>
                    <p className="text-xs text-muted-foreground">Spam in last pull</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Star className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{lastPullResult.high_value}</p>
                    <p className="text-xs text-muted-foreground">High-value in last pull</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Last pull errors */}
      {lastPullResult && lastPullResult.errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">Pull Errors ({lastPullResult.errors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {lastPullResult.errors.slice(0, 10).map((e, i) => (
                <li key={i} className="text-xs text-muted-foreground font-mono">{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>In Zoho API Console, create a <strong>Server-based application</strong>.</li>
            <li>Set the redirect URI to: <code className="bg-muted px-1 rounded text-xs">{process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.vercel.app'}/api/zoho/callback</code></li>
            <li>Copy the Client ID and Client Secret into Vercel environment variables:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-xs">
                <li><code>ZOHO_CLIENT_ID</code></li>
                <li><code>ZOHO_CLIENT_SECRET</code></li>
                <li><code>ZOHO_REDIRECT_URI</code> — same as step 2</li>
              </ul>
            </li>
            <li>Select your data center above and click <strong>Connect Zoho CRM</strong>.</li>
            <li>Grant access on the Zoho consent screen.</li>
            <li>Click <strong>Pull Leads Now</strong> — spam detection runs automatically.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ZohoAdminPage() {
  return (
    <Suspense>
      <ZohoAdminContent />
    </Suspense>
  );
}
