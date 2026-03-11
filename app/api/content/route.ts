import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { PublicContentItem } from '@/types/database';

export const dynamic = 'force-dynamic';

// CORS headers for public API (Phase 2 — any website can embed this)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/content
 *
 * Public REST API endpoint — no auth required.
 * Returns published content with audience_tag 'public' or 'distributor'.
 *
 * Query params:
 *   ?product=SomeProd     — filter by product tag name
 *   ?type=video           — filter by content type
 *   ?audience=distributor — filter by audience tag
 *   ?limit=20             — number of results (default 50, max 100)
 *   ?offset=0             — pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const type = searchParams.get('type');
    const audience = searchParams.get('audience');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = createServiceClient();

    let query = supabase
      .from('content_items')
      .select(
        'id, title, description, content_type, file_url, external_link, thumbnail_url, product_tags, topic_tags, audience_tags, published_at'
      )
      .eq('status', 'published')
      .or(
        "audience_tags.cs.{public},audience_tags.cs.{distributor}"
      )
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (product) {
      query = query.contains('product_tags', [product]);
    }

    if (type) {
      query = query.eq('content_type', type as any);
    }

    if (audience) {
      query = query.contains('audience_tags', [audience]);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch content', detail: error.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        data: data as PublicContentItem[],
        pagination: {
          limit,
          offset,
          total: count,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
