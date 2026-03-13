import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

const USER_AGENT = 'Mozilla/5.0 (compatible; AxisContentHub/1.0; +https://axis.com)';
const FETCH_OPTS = {
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9' },
  signal: AbortSignal.timeout(15000),
};
const MAX_RESULTS = 500;

// Extract all <loc> values from a sitemap XML string
function extractSitemapLocs(xml: string): string[] {
  const results: string[] = [];
  const re = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

// Explicitly non-blog path segments to skip
const SKIP_SEGMENTS = /\/(product|products|shop|store|cart|checkout|account|login|register|signup|wp-content|wp-includes|wp-admin|wp-login|wp-json|feed|tag|category|author|search|page\/\d)\//i;
const SKIP_EXTENSIONS = /\.(xml|json|rss|atom|jpg|jpeg|png|gif|svg|pdf|css|js|woff|woff2)$/i;

// Blog-like path keywords
const BLOG_SEGMENTS = /\/(blog|article|articles|news|post|posts|insight|insights|update|updates|story|stories|resource|resources|press|media)\//i;

function isLikelyBlogPost(url: string, rootHostname: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== rootHostname) return false;
    const path = parsed.pathname;
    if (path === '/' || path === '') return false;
    if (SKIP_EXTENSIONS.test(path)) return false;
    if (SKIP_SEGMENTS.test(path)) return false;
    // Must either be under a known blog segment OR be a slug-like leaf (depth >= 2, has hyphens)
    const hasBlogSegment = BLOG_SEGMENTS.test(path);
    const segments = path.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    const hasSlug = lastSegment.includes('-') && lastSegment.length > 12 && segments.length >= 2;
    return hasBlogSegment || hasSlug;
  } catch {
    return false;
  }
}

// Sitemap whose URL suggests it's blog-specific
function isBlogSitemap(sitemapUrl: string): boolean {
  return /blog|post|article|news|insight|story/i.test(sitemapUrl);
}

async function fetchSitemapLocs(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text.includes('<loc>')) return [];
  return extractSitemapLocs(text);
}

async function trySitemap(rootUrl: URL, blogPrefix: string | null): Promise<{ urls: string[]; source: string } | null> {
  const candidates = [
    `${rootUrl.origin}/sitemap.xml`,
    `${rootUrl.origin}/sitemap_index.xml`,
    `${rootUrl.origin}/post-sitemap.xml`,
    `${rootUrl.origin}/blog-sitemap.xml`,
  ];

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, { ...FETCH_OPTS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<loc>') && !text.includes('<sitemap>')) continue;

      // Sitemap index — fetch nested sitemaps
      if (text.includes('<sitemapindex') || (text.includes('<sitemap>') && !text.includes('<urlset'))) {
        const nestedUrls = extractSitemapLocs(text);

        // 1. First try sitemaps that mention 'blog' / 'post' in their URL
        const blogSitemaps = nestedUrls.filter(isBlogSitemap);
        const otherSitemaps = nestedUrls.filter((u) => !isBlogSitemap(u));
        const orderedNested = [...blogSitemaps, ...otherSitemaps].slice(0, 10);

        const allLocs: string[] = [];
        for (const nested of orderedNested) {
          const locs = await fetchSitemapLocs(nested);
          allLocs.push(...locs);
          // If we already have enough blog-specific hits from a blog sitemap, stop early
          if (blogSitemaps.includes(nested) && locs.length > 0) {
            // Filter immediately and check if we have results
            const hits = blogPrefix
              ? locs.filter((u) => u.startsWith(blogPrefix))
              : locs.filter((u) => isLikelyBlogPost(u, rootUrl.hostname));
            if (hits.length > 0) {
              return { urls: allLocs, source: 'sitemap' };
            }
          }
        }
        if (allLocs.length > 0) return { urls: allLocs, source: 'sitemap' };
      } else {
        const locs = extractSitemapLocs(text);
        if (locs.length > 0) return { urls: locs, source: 'sitemap' };
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
      const clean = abs.href.split('#')[0].replace(/\?.*$/, '');
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

    // If the user gave a specific path (e.g. /blog/), use it as a prefix filter
    const userPath = rootUrl.pathname.replace(/\/$/, '');
    const blogPrefix = userPath && userPath !== ''
      ? `${rootUrl.origin}${userPath}/`
      : null;

    // 1. Try sitemap
    let allUrls: string[] = [];
    let source = 'sitemap';

    try {
      const sitemapResult = await trySitemap(rootUrl, blogPrefix);
      if (sitemapResult) {
        allUrls = sitemapResult.urls;
        source = sitemapResult.source;
      }
    } catch { /* fall through */ }

    // 2. If no sitemap results, scrape the page the user gave
    if (allUrls.length === 0) {
      source = 'page';
      try {
        allUrls = await scrapePageLinks(url, rootHostname);
      } catch (err) {
        return NextResponse.json({
          error: `Could not fetch the page: ${err instanceof Error ? err.message : 'Unknown error'}. Check the URL and try again.`,
        }, { status: 422 });
      }
    }

    // 3. Filter — if user gave a specific path, ONLY show URLs under that path.
    //    Otherwise, use blog-post heuristics.
    let filtered: string[];
    if (blogPrefix) {
      // Exact prefix match first
      filtered = allUrls.filter((u) => u.startsWith(blogPrefix));
      // If nothing matched, fall back to heuristics (maybe their /blog/ page uses a different path)
      if (filtered.length === 0) {
        filtered = allUrls.filter((u) => isLikelyBlogPost(u, rootHostname));
      }
    } else {
      filtered = allUrls.filter((u) => isLikelyBlogPost(u, rootHostname));
    }

    // Deduplicate and sort
    const seenUrls = new Set<string>();
    const unique: string[] = [];
    for (const u of filtered) {
      if (!seenUrls.has(u)) { seenUrls.add(u); unique.push(u); }
    }
    unique.sort();
    const result = unique.slice(0, MAX_RESULTS);

    if (result.length === 0) {
      return NextResponse.json({
        error: `No blog posts found under "${url}". The sitemap may list posts under a different path — try entering your blog index URL directly (e.g. https://example.com/blog).`,
        urls: [],
        source,
        total: 0,
      });
    }

    return NextResponse.json({ urls: result, source, total: result.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
