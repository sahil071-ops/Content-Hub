import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';
import type { ArchivedBlogData } from '@/components/upload/blog-url-input';

/**
 * Full browser-like headers including Sec-Fetch-* and Sec-Ch-Ua-* fingerprint headers.
 * Unlike browser fetch (which strips Sec-* headers), Node.js fetch CAN send these.
 * Cloudflare's bot detection checks for these — their absence is a strong bot signal.
 */
const BROWSER_FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
  },
};

/** Derive a readable title from a URL slug when we can't fetch the page. */
function titleFromUrl(parsedUrl: URL): string {
  const slug = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
  if (!slug) return parsedUrl.hostname;
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({
        error: 'Invalid URL. Please enter a valid URL starting with https:// or http://.',
      }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({
        error: 'Only HTTP and HTTPS URLs are supported.',
      }, { status: 400 });
    }

    // Fetch with full browser fingerprint (Sec-* headers) — Node.js can send these, browsers can't
    let html: string | null = null;
    let lastStatus = 0;

    try {
      const response = await fetch(url, {
        ...BROWSER_FETCH_OPTIONS,
        signal: AbortSignal.timeout(20000),
      });
      lastStatus = response.status;

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
          return NextResponse.json({
            error: `This URL points to a ${contentType} file, not a web page. Use the file upload feature instead.`,
          }, { status: 422 });
        }
        html = await response.text();
      }
    } catch (fetchErr) {
      const message = fetchErr instanceof Error ? fetchErr.message : '';
      if (message.includes('timeout') || message.includes('TimeoutError')) {
        return NextResponse.json({
          error: 'The page took too long to respond (20s timeout). The site may be slow or blocking automated access.',
        }, { status: 422 });
      }
      // Network error — fall through to partial archive
    }

    // Site is blocking server-side fetches.
    // Return a partial/link-only archive so the user can still save the post.
    if (html === null) {
      return NextResponse.json({
        url,
        title: titleFromUrl(parsedUrl),
        description: null,
        og_image: null,
        text_content: '',
        archived_at: new Date().toISOString(),
        partial: true,
        partial_reason: `HTTP ${lastStatus || 'error'} — site is blocking server access. Link saved; content not archived.`,
      });
    }

    // Parse HTML
    const root = parse(html);

    const getMetaContent = (property: string): string | null =>
      root.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ||
      root.querySelector(`meta[name="${property}"]`)?.getAttribute('content') ||
      null;

    const title =
      getMetaContent('og:title') ||
      root.querySelector('title')?.text ||
      root.querySelector('h1')?.text ||
      parsedUrl.hostname;

    const description =
      getMetaContent('og:description') ||
      getMetaContent('description') ||
      null;

    const og_image = getMetaContent('og:image') || null;

    ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'iframe', 'svg'].forEach((tag) => {
      root.querySelectorAll(tag).forEach((el) => el.remove());
    });

    const mainContent =
      root.querySelector('article') ||
      root.querySelector('main') ||
      root.querySelector('[role="main"]') ||
      root.querySelector('.content') ||
      root.querySelector('.post-content') ||
      root.querySelector('.article-body') ||
      root.querySelector('body');

    const rawText = mainContent?.text || root.text;
    const text_content = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 50000);

    const result: ArchivedBlogData = {
      url,
      title: title.trim(),
      description: description?.trim() || null,
      og_image,
      text_content,
      archived_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
