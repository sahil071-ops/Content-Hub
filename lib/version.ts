// ============================================================
// AXIS CONTENT HUB — Version Tracking
// Build date and commit SHA are injected at deploy time via
// next.config.js env. Version always reflects the latest deploy.
// ============================================================

// Build date, time, and commit SHA are set at Vercel build time
const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;
const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
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
// Combine date + time: "13 Mar 2026 11:23"
const dateTimeLabel = dateLabel
  ? buildTime ? `${dateLabel} ${buildTime}` : dateLabel
  : null;

// e.g. "13 Mar 2026 11:23 · abc1234"  or just  "13 Mar 2026 11:23"  or fallback "0.1.0"
export const VERSION = dateTimeLabel
  ? buildId ? `${dateTimeLabel} · ${buildId}` : dateTimeLabel
  : buildId ? `build ${buildId}` : '0.5.0';

export const APP_NAME = 'Axis Content Hub';
