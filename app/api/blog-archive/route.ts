import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'node-html-parser';
import type { ArchivedBlogData } from '@/components/upload/blog-url-input';

const USER_AGENT = 'Mozilla/5.0 (compatible; AxisContentHub/1.0; +https://axis.com)';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    // Validate URL
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

    // Fetch the page
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        return NextResponse.json({
          error: `Could not fetch the page (HTTP ${response.status}). The site may be blocking automated access, or the URL may require authentication. You can still save the link manually.`,
        }, { status: 422 });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        return NextResponse.json({
          error: `This URL points to a ${contentType} file, not a web page. Use the file upload feature instead.`,
        }, { status: 422 });
      }

      html = await response.text();
    } catch (fetchErr) {
      const message = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
      if (message.includes('timeout') || message.includes('TimeoutError')) {
        return NextResponse.json({
          error: 'The page took too long to respond (timeout after 15 seconds). The site may be slow or blocking automated access.',
        }, { status: 422 });
      }
      return NextResponse.json({
        error: `Failed to fetch the page: ${message}. Check the URL and try again.`,
      }, { status: 422 });
    }

    // Parse HTML
    const root = parse(html);

    // Extract metadata
    const getMetaContent = (property: string): string | null => {
      return (
        root.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ||
        root.querySelector(`meta[name="${property}"]`)?.getAttribute('content') ||
        null
      );
    };

    const title =
      getMetaContent('og:title') ||
      root.querySelector('title')?.text ||
      root.querySelector('h1')?.text ||
      new URL(url).hostname;

    const description =
      getMetaContent('og:description') ||
      getMetaContent('description') ||
      null;

    const og_image = getMetaContent('og:image') || null;

    // Extract main text content
    // Remove scripts, styles, nav, header, footer
    ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'iframe', 'svg'].forEach((tag) => {
      root.querySelectorAll(tag).forEach((el) => el.remove());
    });

    // Try to find article/main content
    const mainContent =
      root.querySelector('article') ||
      root.querySelector('main') ||
      root.querySelector('[role="main"]') ||
      root.querySelector('.content') ||
      root.querySelector('.post-content') ||
      root.querySelector('.article-body') ||
      root.querySelector('body');

    const rawText = mainContent?.text || root.text;

    // Clean up whitespace
    const text_content = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 50000); // Store up to 50k characters

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
