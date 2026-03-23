import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

/**
 * POST /api/linkedin/parse-xlsx
 * Accepts a LinkedIn PostAnalytics_*.xlsx file (multipart form data).
 * Returns structured metrics from the PERFORMANCE and TOP DEMOGRAPHICS sheets.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // ── PERFORMANCE sheet ────────────────────────────────────────
  const perfSheet = workbook.Sheets['PERFORMANCE'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const perfRows: [string, string | number][] = XLSX.utils.sheet_to_json(perfSheet, {
    header: 1,
    defval: '',
  }) as [string, string | number][];

  // Build a label → value map (column A = label, column B = value)
  const perfMap: Record<string, string | number> = {};
  for (const row of perfRows) {
    if (row[0] && row[1] !== undefined && row[1] !== '') {
      perfMap[String(row[0]).trim()] = row[1];
    }
  }

  function numVal(key: string): number | null {
    const v = perfMap[key];
    if (v === undefined || v === '' || v === null) return null;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
  }

  function strVal(key: string): string | null {
    const v = perfMap[key];
    return v != null && v !== '' ? String(v).trim() : null;
  }

  // Parse post_date — LinkedIn exports "Mar 21, 2025" format
  function parseDate(raw: string | null): string | null {
    if (!raw) return null;
    // Try "Mar 21, 2025"
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  }

  const metrics = {
    post_url:      strVal('Post URL'),
    post_date:     parseDate(strVal('Post Date')),
    impressions:   numVal('Impressions'),
    reactions:     numVal('Reactions'),
    comments:      numVal('Comments'),
    shares:        numVal('Reposts'),
    profile_visits: numVal('Profile viewers from this post'),
    follows_gained: numVal('Followers gained from this post'),
    // Extra LinkedIn fields stored as notes
    members_reached: numVal('Members reached'),
    saves:         numVal('Saves'),
    sends:         numVal('Sends on LinkedIn'),
  };

  // ── TOP DEMOGRAPHICS sheet (optional) ───────────────────────
  let demographics: { category: string; value: string; pct: string }[] = [];
  const demoSheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes('demograph')
  );
  if (demoSheetName) {
    const demoSheet = workbook.Sheets[demoSheetName];
    const demoRows: string[][] = XLSX.utils.sheet_to_json(demoSheet, {
      header: 1,
      defval: '',
    }) as string[][];

    // Skip header row
    for (const row of demoRows.slice(1)) {
      if (row[0] && row[1]) {
        demographics.push({
          category: String(row[0]).trim(),
          value: String(row[1]).trim(),
          pct: String(row[2] ?? '').trim(),
        });
      }
    }
  }

  return NextResponse.json({ metrics, demographics });
}
