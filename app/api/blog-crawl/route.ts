import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
};
const MAX_RESULTS = 500;
const SITEMAP_TIMEOUT_MS = 7000;   // per-sitemap fetch
const PAGE_TIMEOUT_MS = 12000;     // scraping the blog index page

// Extract all <loc> values from a sitemap XML string
function extractSitemapLocs(xml: string): string[] {
  const results: string[] = [];
  const re = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

const SKIP_SEGMENTS =
  /\/(product|products|shop|store|cart|checkout|account|login|register|signup|wp-content|wp-includes|wp-admin|wp-login|wp-json|feed|tag|category|author|search|page\/\d)\//i;
const SKIP_EXTENSIONS =
  /\.(xml|json|rss|atom|jpg|jpeg|png|gif|svg|pdf|css|js|woff|woff2)$/i;
const BLOG_SEGMENTS =
  /\/(blog|article|articles|news|post|posts|insight|insights|update|updates|story|stories|resource|resources|press|media)\//i;

function isLikelyBlogPost(url: string, rootHostname: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== rootHostname) return false;
    const path = parsed.pathname;
    if (path === '/' || path === '') return false;
    if (SKIP_EXTENSIONS.test(path)) return false;
    if (SKIP_SEGMENTS.test(path)) return false;
    const hasBlogSegment = BLOG_SEGMENTS.test(path);
    const segments = path.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    const hasSlug = lastSegment.includes('-') && lastSegment.length > 12 && segments.length >= 2;
    return hasBlogSegment || hasSlug;
  } catch {
    return false;
  }
}

function isBlogSitemapUrl(sitemapUrl: string): boolean {
  return /blog|post|article|news|insight|story/i.test(sitemapUrl);
}

// Fetch a single sitemap and return its <loc> entries
async function fetchLocs(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return extractSitemapLocs(text);
  } catch {
    return [];
  }
}

async function discoverFromSitemap(
  origin: string,
  blogPrefix: string | null,
  rootHostname: string,
): Promise<string[] | null> {
  // Step 1: Try blog-specific sitemaps in parallel (fastest path)
  const blogSitemapCandidates = [
    `${origin}/post-sitemap.xml`,
    `${origin}/blog-sitemap.xml`,
    `${origin}/news-sitemap.xml`,
  ];

  const blogResults = await Promise.all(blogSitemapCandidates.map(fetchLocs));
  for (const locs of blogResults) {
    if (locs.length === 0) continue;
    const hits = blogPrefix
      ? locs.filter((u) => u.startsWith(blogPrefix))
      : locs.filter((u) => isLikelyBlogPost(u, rootHostname));
    if (hits.length > 0) return locs;
  }

  // Step 2: Try the main sitemap / sitemap index
  const mainCandidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];

  for (const sitemapUrl of mainCandidates) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<loc>') && !text.includes('<sitemap>')) continue;

      // Is it a sitemap index?
      if (text.includes('<sitemapindex') || (text.includes('<sitemap>') && !text.includes('<urlset'))) {
        const nestedUrls = extractSitemapLocs(text);

        // Prefer blog-named nested sitemaps — fetch those in parallel first
        const blogNested = nestedUrls.filter(isBlogSitemapUrl).slice(0, 4);
        const otherNested = nestedUrls.filter((u) => !isBlogSitemapUrl(u)).slice(0, 4);

        if (blogNested.length > 0) {
          const results = await Promise.all(blogNested.map(fetchLocs));
          const locs = results.flat();
          const hits = blogPrefix
            ? locs.filter((u) => u.startsWith(blogPrefix))
            : locs.filter((u) => isLikelyBlogPost(u, rootHostname));
          if (hits.length > 0) return locs;
        }

        // No blog-specific sitemap found — fetch other nested sitemaps in parallel
        if (otherNested.length > 0) {
          const results = await Promise.all(otherNested.map(fetchLocs));
          return results.flat();
        }
      } else {
        // Regular sitemap — return all locs directly
        const locs = extractSitemapLocs(text);
        if (locs.length > 0) return locs;
      }
    } catch { /* try next */ }
  }

  return null;
}

async function scrapePageLinks(url: string, rootHostname: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
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
    const userPath = rootUrl.pathname.replace(/\/$/, '');
    const blogPrefix = userPath && userPath !== ''
      ? `${rootUrl.origin}${userPath}/`
      : null;

    // 1. Try sitemap discovery
    let allUrls: string[] = [];
    let source = 'sitemap';

    try {
      const sitemapUrls = await discoverFromSitemap(rootUrl.origin, blogPrefix, rootHostname);
      if (sitemapUrls) allUrls = sitemapUrls;
    } catch { /* fall through */ }

    // 2. If sitemap gave nothing, scrape the user's page directly
    if (allUrls.length === 0) {
      source = 'page';
      try {
        allUrls = await scrapePageLinks(url, rootHostname);
      } catch (err) {
        return NextResponse.json({
          error: `Could not reach "${url}": ${err instanceof Error ? err.message : 'timeout'}. The site may be slow or blocking automated access. Try again in a moment.`,
        }, { status: 422 });
      }
    }

    // 3. Filter — if user gave a specific path, only show URLs under that path
    let filtered: string[];
    if (blogPrefix) {
      filtered = allUrls.filter((u) => u.startsWith(blogPrefix));
      if (filtered.length === 0) {
        // Fallback: heuristic filter (maybe their blog uses a different URL structure)
        filtered = allUrls.filter((u) => isLikelyBlogPost(u, rootHostname));
      }
    } else {
      filtered = allUrls.filter((u) => isLikelyBlogPost(u, rootHostname));
    }

    // 4. Deduplicate, sort, cap
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const u of filtered) {
      if (!seen.has(u)) { seen.add(u); unique.push(u); }
    }
    unique.sort();
    const result = unique.slice(0, MAX_RESULTS);

    if (result.length === 0) {
      return NextResponse.json({
        error: `No blog posts were found under "${url}". If your posts live at a different path, try entering that URL directly (e.g. https://example.com/news or https://example.com/articles).`,
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
