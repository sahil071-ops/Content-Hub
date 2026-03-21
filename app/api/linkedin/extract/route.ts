import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LinkedInExtractedMetrics } from '@/types/database';

export const maxDuration = 60;

/**
 * Extract LinkedIn post metrics from a screenshot using Claude Vision.
 * Accepts multipart form data with a screenshot file.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!['admin', 'marketing'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI extraction not configured' }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get('screenshot') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Convert to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a LinkedIn post analytics screenshot. Extract the following metrics if visible: impressions, reactions, comments, shares, profile visits, follows gained, link clicks, and post date.

Return ONLY a valid JSON object with these exact keys (use null for any metric not visible):
{
  "impressions": number or null,
  "reactions": number or null,
  "comments": number or null,
  "shares": number or null,
  "profile_visits": number or null,
  "follows_gained": number or null,
  "link_clicks": number or null,
  "post_date": "YYYY-MM-DD" or null
}

Do not include any text outside the JSON object.`,
          },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const raw = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();

    let metrics: LinkedInExtractedMetrics;
    try {
      metrics = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        metrics: null,
        extraction_status: 'manual',
        extraction_notes: 'Could not parse AI response',
      });
    }

    // Determine extraction status
    const values = Object.values(metrics);
    const nonNull = values.filter((v) => v !== null).length;
    const extraction_status = nonNull === 0 ? 'manual' : nonNull < values.length ? 'ai_partial' : 'ai_extracted';

    const nullKeys = Object.entries(metrics)
      .filter(([, v]) => v === null)
      .map(([k]) => k.replace(/_/g, ' '));

    const extraction_notes = nullKeys.length > 0
      ? `Not visible in screenshot: ${nullKeys.join(', ')}`
      : null;

    return NextResponse.json({ metrics, extraction_status, extraction_notes });

  } catch (e: unknown) {
    return NextResponse.json({
      metrics: null,
      extraction_status: 'manual',
      extraction_notes: e instanceof Error ? e.message : 'Extraction failed',
    });
  }
}
