/**
 * Next.js instrumentation file — runs once on server startup.
 * Logs clear warnings for any missing analytics environment variables
 * so misconfiguration is immediately visible in Vercel Function logs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const checks: { name: string; present: boolean; hint: string }[] = [
      {
        name: 'BREVO_API_KEY',
        present: !!process.env.BREVO_API_KEY,
        hint: 'app.brevo.com → Settings → SMTP & API → API Keys tab (starts with xkeysib-)',
      },
      {
        name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        present: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hint: 'GCP Console → IAM & Admin → Service Accounts',
      },
      {
        name: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        present: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        hint: 'GCP Console → Service Account → Keys → Add Key → JSON',
      },
      {
        name: 'GA4_PROPERTY_ID_MAIN',
        present: !!process.env.GA4_PROPERTY_ID_MAIN,
        hint: 'Google Analytics → Admin → Property Settings → Property ID',
      },
      {
        name: 'GSC_SITE_URL_MAIN',
        present: !!process.env.GSC_SITE_URL_MAIN,
        hint: 'Google Search Console → Settings → property URL',
      },
      {
        name: 'YOUTUBE_CHANNEL_ID',
        present: !!process.env.YOUTUBE_CHANNEL_ID,
        hint: 'YouTube → your channel → About → Share → Copy channel ID',
      },
      {
        name: 'YOUTUBE_API_KEY',
        present: !!process.env.YOUTUBE_API_KEY,
        hint: 'GCP Console → APIs & Services → Credentials → API key (YouTube Data API v3 enabled)',
      },
      {
        name: 'ANTHROPIC_API_KEY',
        present: !!process.env.ANTHROPIC_API_KEY,
        hint: 'console.anthropic.com → API Keys',
      },
    ];

    const missing = checks.filter((c) => !c.present);

    if (missing.length === 0) {
      console.log('[startup] ✓ All analytics environment variables are set');
    } else {
      console.warn(
        `[startup] ⚠ Missing ${missing.length} analytics env var${missing.length !== 1 ? 's' : ''} — MIS data pulls will be skipped for these sources:`
      );
      for (const { name, hint } of missing) {
        console.warn(`  ✗ ${name}\n    → ${hint}`);
      }
    }
  }
}
