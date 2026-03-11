import { NextRequest, NextResponse } from 'next/server';
import { extractYouTubeId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required.' }, { status: 400 });
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return NextResponse.json({
      error: 'Could not extract a YouTube video ID from this URL. Please paste a valid YouTube video link (e.g. https://youtube.com/watch?v=...).',
    }, { status: 400 });
  }

  try {
    // YouTube oEmbed API — free, no API key needed
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'AxisContentHub/1.0' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({
          error: 'This YouTube video is private or embeds are disabled. Please check the video settings or use a public video.',
        }, { status: 400 });
      }
      if (response.status === 404) {
        return NextResponse.json({
          error: 'YouTube video not found. Please check the URL and try again.',
        }, { status: 404 });
      }
      return NextResponse.json({
        error: `YouTube API error (status ${response.status}). Please try again or check the URL.`,
      }, { status: 500 });
    }

    const data = await response.json();

    // Get the highest quality thumbnail available
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return NextResponse.json({
      video_id: videoId,
      title: data.title,
      author_name: data.author_name,
      thumbnail_url: thumbnailUrl,
      embed_html: data.html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      error: `Failed to fetch YouTube video details: ${message}. Please check your network connection and try again.`,
    }, { status: 500 });
  }
}
