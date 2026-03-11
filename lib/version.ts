// ============================================================
// AXIS CONTENT HUB — Version Tracking
// Semantic version is set here. Build ID is injected at deploy
// time from VERCEL_GIT_COMMIT_SHA via next.config.js.
// ============================================================

const SEMVER = '0.1.0';
const buildId = process.env.NEXT_PUBLIC_BUILD_ID;

export const VERSION = buildId ? `${SEMVER}+${buildId}` : SEMVER;
export const APP_NAME = 'Axis Content Hub';
