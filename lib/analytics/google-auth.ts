import { google } from 'googleapis';
import type { JWT } from 'googleapis-common';

/**
 * Robustly parses the Google service account private key from an env var.
 *
 * Vercel can store the PEM key in several broken formats depending on how
 * it was pasted:
 *   (a) Literal \n sequences instead of real newlines  → replace(/\\n/g, '\n')
 *   (b) JSON-quoted string with escaped newlines        → JSON.parse() first
 *   (c) The key body has no whitespace at all           → re-fold the base64 body
 *
 * The final check re-assembles the PEM header/body/footer with real newlines,
 * which is what OpenSSL's DECODER routines require.
 */
function parsePrivateKey(raw: string): string {
  let key = raw.trim();

  // (b) If Vercel wrapped the whole value in extra JSON quotes
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    try { key = JSON.parse(key); } catch { /* not valid JSON, use as-is */ }
  }

  // (a) Replace literal \n sequences with real newlines
  key = key.replace(/\\n/g, '\n');

  // Normalise: strip all existing newlines from the body, then re-wrap at 64 chars.
  // This fixes keys that arrived as one long line or with wrong line lengths.
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';

  if (key.includes(header)) {
    const start = key.indexOf(header) + header.length;
    const end   = key.indexOf(footer);
    if (start < end) {
      const body = key.slice(start, end).replace(/\s/g, '');
      // Wrap every 64 chars
      const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
      key = `${header}\n${wrapped}\n${footer}\n`;
    }
  }

  return key;
}

/**
 * Creates a fresh Google JWT auth client on every call.
 * (Not cached — caching a broken JWT across requests hides env-var issues.)
 */
export function getGoogleAuth(): JWT {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !keyRaw) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars'
    );
  }

  const key = parsePrivateKey(keyRaw);

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
  });
}
