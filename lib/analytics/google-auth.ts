import { google } from 'googleapis';
import type { JWT } from 'googleapis-common';

let _auth: JWT | null = null;

/**
 * Returns a cached Google JWT auth client using the service account credentials
 * from environment variables. Scoped for GA4, Search Console, and YouTube Analytics.
 */
export function getGoogleAuth(): JWT {
  if (_auth) return _auth;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !keyRaw) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars'
    );
  }

  // Vercel stores multiline keys with literal \n — replace them
  const key = keyRaw.replace(/\\n/g, '\n');

  _auth = new google.auth.JWT({
    email,
    key,
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
  });

  return _auth;
}
