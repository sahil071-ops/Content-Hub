import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

const USER_AGENT = 'Mozilla/5.0 (compatible; AxisContentHub/1.0; +https://axis.com)';
const FETCH_OPTS = {
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9' },
  signal: AbortSignal.timeout(15000),
};

// Extract all <loc> values from a sitemap XML string
function extractSitemapLocs(xml: string): string[] {
  const results: string[] = [];
  const re = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

// Score a URL on how likely it is to be a blog post (not a category/tag page)
function isBlogPostUrl(url: string, rootHostname: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be same hostname
    if (parsed.hostname !== rootHostname) return false;
    const path = parsed.pathname;
    // Skip root, images, feeds, admin paths
    if (path === '/' || path === '') return false;
    if (/\.(xml|json|rss|atom|jpg|jpeg|png|gif|svg|pdf|css|js)$/i.test(path)) return false;
    if (/\/(wp-admin|wp-login|wp-json|feed|tag|category|author|page\/\d|search)\//i.test(path)) return false;
    // Prefer paths that contain blog-like segments
    const hasBlogSegment = /\/(blog|article|articles|news|post|posts|insight|insights|update|updates|story|stories|resource|resources|press|media)\//i.test(path);
    // Prefer slug-like paths (contain hyphens)
    const segmentCount = path.replace(/^\//, '').split('/').filter(Boolean).length;
    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    const hasSlug = lastSegment.includes('-') && lastSegment.length > 10;
    // Accept if: has a blog segment, or has a slug-like last segment with depth >= 2
    return hasBlogSegment || (hasSlug && segmentCount >= 2);
  } catch {
    return false;
  }
}

async function trySitemap(rootUrl: URL): Promise<string[] | null> {
  const candidates = [
    `${rootUrl.origin}/sitemap.xml`,
    `${rootUrl.origin}/sitemap_index.xml`,
    `${rootUrl.origin}/post-sitemap.xml`,
    `${rootUrl.origin}/page-sitemap.xml`,
  ];

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<loc>') && !text.includes('<sitemap>')) continue;

      // Check if it's a sitemap index (contains nested sitemaps)
      if (text.includes('<sitemapindex') || text.includes('<sitemap>')) {
        const nestedUrls = extractSitemapLocs(text);
        const allLocs: string[] = [];
        // Fetch nested sitemaps (up to 5)
        for (const nested of nestedUrls.slice(0, 5)) {
          try {
            const nestedRes = await fetch(nested, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) });
            if (!nestedRes.ok) continue;
            const nestedText = await nestedRes.text();
            allLocs.push(...extractSitemapLocs(nestedText));
          } catch { /* skip */ }
        }
        if (allLocs.length > 0) return allLocs;
      } else {
        const locs = extractSitemapLocs(text);
        if (locs.length > 0) return locs;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function scrapePageLinks(url: string, rootHostname: string): Promise<string[]> {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);

  const seen = new Set<string>();
  const links: string[] = [];
  root.querySelectorAll('a[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (!href) return;
    try {
      const abs = new URL(href, url);
      const clean = abs.href.split('#')[0];
      if (abs.hostname === rootHostname && !seen.has(clean)) {
        seen.add(clean);
        links.push(clean);
      }
    } catch { /* skip */ }
  });
  return links;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });

    let rootUrl: URL;
    try {
      rootUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 });
    }

    const rootHostname = rootUrl.hostname;

    // 1. Try sitemap first
    let allUrls: string[] | null = null;
    let source = 'sitemap';

    try {
      allUrls = await trySitemap(rootUrl);
    } catch { /* fall through */ }

    // 2. Fall back to page scraping
    if (!allUrls || allUrls.length === 0) {
      source = 'page';
      try {
        const pageLinks = await scrapePageLinks(url, rootHostname);
        allUrls = pageLinks;
      } catch (err) {
        return NextResponse.json({
          error: `Could not fetch the page: ${err instanceof Error ? err.message : 'Unknown error'}. Check the URL and try again.`,
        }, { status: 422 });
      }
    }

    // Filter to likely blog posts
    const blogUrls = allUrls
      .filter((u) => isBlogPostUrl(u, rootHostname))
      .slice(0, 200);

    // Deduplicate
    const seenUrls = new Set<string>();
    const unique: string[] = [];
    for (const u of blogUrls) {
      if (!seenUrls.has(u)) { seenUrls.add(u); unique.push(u); }
    }
    unique.sort();

    return NextResponse.json({
      urls: unique,
      source,
      total: unique.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
