// ============================================================
// AXIS CONTENT HUB — Version Tracking
// Build date and commit SHA are injected at deploy time via
// next.config.js env. Version always reflects the latest deploy.
// ============================================================

// Build date is set at Vercel build time (YYYY-MM-DD)
const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;
const buildId = process.env.NEXT_PUBLIC_BUILD_ID;

// Format date as "13 Mar 2026" for readability
function formatBuildDate(iso: string): string {
  try {
    const [year, month, day] = iso.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const dateLabel = buildDate ? formatBuildDate(buildDate) : null;

// e.g. "13 Mar 2026 · abc1234"  or just  "13 Mar 2026"  or fallback "v0.1.0"
export const VERSION = dateLabel
  ? buildId ? `${dateLabel} · ${buildId}` : dateLabel
  : buildId ? `build ${buildId}` : '0.1.0';

export const APP_NAME = 'Axis Content Hub';
