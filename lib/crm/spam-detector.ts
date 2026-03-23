/**
 * Lead spam detection.
 *
 * Two-stage pipeline:
 * 1. Heuristic rules — fast, zero API cost.
 *    Produces a spam_score 0–100 and a list of reasons.
 * 2. Claude classification — only called for borderline scores (20–75).
 *    Improves accuracy without classifying every lead.
 *
 * Final verdict:
 *   spam_score >= 70  → is_spam = true
 *   spam_score <= 30  → is_spam = false
 *   30 < score < 70   → Claude decides
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ZohoLeadRecord } from './zoho-client';

// Consumer / free email providers (high signal of non-B2B lead)
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.in', 'outlook.com', 'outlook.in',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'rediffmail.com', 'ymail.com', 'aol.com', 'protonmail.com', 'proton.me',
  'tutanota.com', 'zohomail.com',
]);

// Generic role-based / obviously spam addresses
const SPAM_LOCAL_PARTS = new Set([
  'test', 'demo', 'spam', 'admin', 'noreply', 'no-reply', 'info',
  'hello', 'contact', 'support', 'sales', 'marketing', 'abuse',
  'postmaster', 'webmaster', 'root', 'user', 'guest', 'sample',
  'example', 'fake', 'invalid', 'null', 'none', 'xxx',
]);

export interface SpamResult {
  spam_score: number;         // 0–100
  is_spam: boolean;
  spam_reasons: string[];
}

/** Heuristic-only scoring. Returns score and reasons. */
function heuristicScore(r: ZohoLeadRecord): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // ── No contact information ──────────────────────────────────
  if (!r.Email && !r.Phone && !r.Mobile) {
    score += 40;
    reasons.push('No email or phone number');
  }

  // ── Email analysis ──────────────────────────────────────────
  if (r.Email) {
    const email = r.Email.toLowerCase().trim();
    const [local, domain] = email.split('@');

    if (!domain) {
      score += 30;
      reasons.push('Malformed email address');
    } else {
      if (FREE_DOMAINS.has(domain)) {
        score += 20;
        reasons.push('Personal email domain (not business)');
      }
      if (SPAM_LOCAL_PARTS.has(local)) {
        score += 25;
        reasons.push(`Generic email prefix "${local}"`);
      }
      // Multiple dots or numbers suggest throwaway
      if (/\d{4,}/.test(local)) {
        score += 10;
        reasons.push('Email contains long number sequence');
      }
    }
  }

  // ── Name analysis ───────────────────────────────────────────
  const firstName = r.First_Name?.trim() ?? '';
  const lastName  = r.Last_Name?.trim() ?? '';
  const fullName  = `${firstName} ${lastName}`.trim();

  if (!firstName && !lastName) {
    score += 15;
    reasons.push('No name provided');
  } else {
    // Single-character names
    if (firstName.length === 1 || lastName.length === 1) {
      score += 10;
      reasons.push('Single-character name field');
    }
    // Names with digits
    if (/\d/.test(fullName)) {
      score += 15;
      reasons.push('Name contains digits');
    }
    // Repeated chars (e.g. "aaaa", "xxxxx")
    if (/(.)\1{3,}/.test(fullName.toLowerCase())) {
      score += 20;
      reasons.push('Name contains repeated characters');
    }
    // All caps or all lower (minor signal)
    if (fullName.length > 3 && (fullName === fullName.toUpperCase() || fullName === fullName.toLowerCase())) {
      score += 5;
      reasons.push('Name is all caps or all lowercase');
    }
  }

  // ── No company for a B2B lead ────────────────────────────────
  if (!r.Company) {
    score += 10;
    reasons.push('No company name');
  }

  // Cap at 100
  return { score: Math.min(score, 100), reasons };
}

/** Use Claude to classify a borderline lead. */
async function claudeClassify(r: ZohoLeadRecord): Promise<{ is_spam: boolean; reason: string }> {
  const client = new Anthropic();

  const leadSummary = JSON.stringify({
    name: `${r.First_Name ?? ''} ${r.Last_Name ?? ''}`.trim(),
    email: r.Email,
    company: r.Company,
    designation: r.Designation,
    phone: r.Phone || r.Mobile,
    country: r.Country,
    lead_source: r.Lead_Source,
    description: r.Description?.slice(0, 300),
  }, null, 2);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `You are a B2B lead quality analyst for Axis Electrical Products, a manufacturer of electrical distribution equipment. Analyse this CRM lead and determine if it is SPAM or a legitimate B2B lead.

Lead data:
${leadSummary}

Respond with JSON only:
{"is_spam": true/false, "reason": "one sentence reason"}`,
    }],
  });

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { is_spam: false, reason: 'Classification inconclusive' };
  }
}

/**
 * Analyse a lead for spam.
 * Calls Claude only for borderline scores (20–75).
 */
export async function analyseSpam(r: ZohoLeadRecord): Promise<SpamResult> {
  const { score, reasons } = heuristicScore(r);

  // Clear-cut cases — no Claude needed
  if (score >= 70) {
    return { spam_score: score, is_spam: true, spam_reasons: reasons };
  }
  if (score <= 20) {
    return { spam_score: score, is_spam: false, spam_reasons: reasons };
  }

  // Borderline — ask Claude
  try {
    const { is_spam, reason } = await claudeClassify(r);
    const finalScore = is_spam ? Math.max(score, 65) : Math.min(score, 35);
    return {
      spam_score: finalScore,
      is_spam,
      spam_reasons: is_spam ? [...reasons, reason] : reasons,
    };
  } catch {
    // Fallback: trust heuristics
    return { spam_score: score, is_spam: score >= 50, spam_reasons: reasons };
  }
}

/** Compute a quality score (0–100) for a non-spam lead. */
export function computeQualityScore(r: ZohoLeadRecord): number {
  let score = 0;

  if (r.Email) {
    score += 20;
    const domain = r.Email.split('@')[1]?.toLowerCase();
    if (domain && !FREE_DOMAINS.has(domain)) score += 15; // Business email
  }
  if (r.Company) score += 20;
  if (r.Phone || r.Mobile) score += 15;
  if (r.Designation) {
    score += 10;
    const title = r.Designation.toLowerCase();
    const seniorKeywords = [
      'director', 'manager', 'vp', 'vice president', 'ceo', 'coo', 'cto',
      'president', 'owner', 'founder', 'head', 'chief', 'principal', 'partner',
      'procurement', 'purchase', 'buyer', 'engineer',
    ];
    if (seniorKeywords.some(k => title.includes(k))) score += 10;
  }
  if (r.Website) score += 5;
  if (r.Country) score += 5;

  return Math.min(score, 100);
}
