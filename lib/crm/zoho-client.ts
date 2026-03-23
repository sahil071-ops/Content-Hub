/**
 * Zoho CRM API client with automatic token refresh.
 *
 * Zoho uses OAuth 2.0 server-side. The access token expires every hour.
 * This client reads the stored connection from Supabase, refreshes the
 * token when needed, and makes API calls against the correct data center.
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface ZohoLeadRecord {
  id: string;
  First_Name: string | null;
  Last_Name: string | null;
  Email: string | null;
  Phone: string | null;
  Mobile: string | null;
  Company: string | null;
  Designation: string | null;
  Website: string | null;
  Lead_Source: string | null;
  Industry: string | null;
  Lead_Status: string | null;
  Rating: string | null;
  Description: string | null;
  Country: string | null;
  Created_Time: string | null;
  Modified_Time: string | null;
  [key: string]: unknown;
}

interface StoredConnection {
  id: string;
  data_center: string;
  access_token: string | null;
  refresh_token: string;
  token_expires_at: string | null;
}

function zohoBase(dc: string): string {
  const bases: Record<string, string> = {
    com: 'https://accounts.zoho.com',
    eu:  'https://accounts.zoho.eu',
    in:  'https://accounts.zoho.in',
    au:  'https://accounts.zoho.com.au',
    jp:  'https://accounts.zoho.jp',
  };
  return bases[dc] ?? bases.com;
}

function zohoApiBase(dc: string): string {
  const bases: Record<string, string> = {
    com: 'https://www.zohoapis.com',
    eu:  'https://www.zohoapis.eu',
    in:  'https://www.zohoapis.in',
    au:  'https://www.zohoapis.com.au',
    jp:  'https://www.zohoapis.jp',
  };
  return bases[dc] ?? bases.com;
}

/** Exchange auth code for tokens (first connect). */
export async function exchangeCodeForTokens(code: string, dc: string) {
  const clientId     = process.env.ZOHO_CLIENT_ID!;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET!;
  const redirectUri  = process.env.ZOHO_REDIRECT_URI!;

  const url = new URL(`${zohoBase(dc)}/oauth/v2/token`);
  url.searchParams.set('grant_type',    'authorization_code');
  url.searchParams.set('client_id',     clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('redirect_uri',  redirectUri);
  url.searchParams.set('code',          code);

  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    api_domain: string;
  }>;
}

/** Refresh the stored access token. Returns new access_token. */
async function refreshAccessToken(conn: StoredConnection): Promise<string> {
  const clientId     = process.env.ZOHO_CLIENT_ID!;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET!;

  const url = new URL(`${zohoBase(conn.data_center)}/oauth/v2/token`);
  url.searchParams.set('grant_type',    'refresh_token');
  url.searchParams.set('client_id',     clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('refresh_token', conn.refresh_token);

  const res = await fetch(url.toString(), { method: 'POST' });
  const json = await res.json() as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Token refresh failed: ${json.error ?? await res.text()}`);
  }

  // Persist new token
  const supabase = createServiceClient();
  await supabase.from('zoho_connections').update({
    access_token:     json.access_token,
    token_expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
  }).eq('id', conn.id);

  return json.access_token;
}

/** Get a valid access token, refreshing if needed. */
async function getValidToken(conn: StoredConnection): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const needsRefresh = !conn.access_token || Date.now() > expiresAt - 60_000;
  if (needsRefresh) return refreshAccessToken(conn);
  return conn.access_token!;
}

/** Load the active Zoho connection from Supabase. */
async function loadConnection(): Promise<StoredConnection> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('zoho_connections')
    .select('id, data_center, access_token, refresh_token, token_expires_at')
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error('No active Zoho connection found');
  return data as StoredConnection;
}

/**
 * Fetch leads from Zoho CRM.
 * Returns up to `limit` leads modified after `since` (ISO string).
 */
export async function fetchZohoLeads(options: {
  since?: string;    // ISO date string — only fetch modified after this
  limit?: number;
  page?: number;
}): Promise<{ records: ZohoLeadRecord[]; has_more: boolean }> {
  const conn = await loadConnection();
  const token = await getValidToken(conn);
  const apiBase = zohoApiBase(conn.data_center);

  const perPage = Math.min(options.limit ?? 200, 200);
  const page = options.page ?? 1;

  const url = new URL(`${apiBase}/crm/v2/Leads`);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort_by', 'Modified_Time');
  url.searchParams.set('sort_order', 'desc');

  if (options.since) {
    // Zoho supports modified_since header
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
    'Content-Type': 'application/json',
  };
  if (options.since) {
    headers['If-Modified-Since'] = new Date(options.since).toUTCString();
  }

  const res = await fetch(url.toString(), { headers });
  if (res.status === 304) return { records: [], has_more: false };
  if (!res.ok) throw new Error(`Zoho leads fetch failed ${res.status}: ${await res.text()}`);

  const json = await res.json() as {
    data?: ZohoLeadRecord[];
    info?: { more_records: boolean };
  };

  return {
    records: json.data ?? [],
    has_more: json.info?.more_records ?? false,
  };
}

/** Get the current user's info from Zoho to verify the connection. */
export async function fetchZohoUserInfo(
  accessToken: string,
  dc: string
): Promise<{ email: string; org_id?: string }> {
  const apiBase = zohoApiBase(dc);
  const res = await fetch(`${apiBase}/crm/v2/users?type=CurrentUser`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not fetch Zoho user: ${res.status}`);
  const json = await res.json() as { users?: { email: string; id: string }[] };
  const user = json.users?.[0];
  return { email: user?.email ?? '', org_id: user?.id };
}

/** Build the Zoho OAuth authorization URL. */
export function buildZohoAuthUrl(dc: string, state: string): string {
  const url = new URL(`${zohoBase(dc)}/oauth/v2/auth`);
  url.searchParams.set('scope', 'ZohoCRM.modules.leads.READ,ZohoCRM.users.READ');
  url.searchParams.set('client_id', process.env.ZOHO_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', process.env.ZOHO_REDIRECT_URI!);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('state', state);
  return url.toString();
}
