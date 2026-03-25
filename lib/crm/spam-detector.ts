/**
 * Lead spam detection.
 *
 * Two-stage pipeline:
 * 1. Heuristic rules — fast, zero API cost.
 * 2. Claude Haiku — only for borderline scores (20–70).
 *    Accepts feedback training examples so the system learns
 *    from past corrections without any model fine-tuning.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ZohoLeadRecord } from './zoho-client';
export { computeQualityScore, computeQualityBreakdown } from './quality-score';

const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.in', 'outlook.com', 'outlook.in',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'rediffmail.com', 'ymail.com', 'aol.com', 'protonmail.com', 'proton.me',
  'tutanota.com', 'zohomail.com',
]);

const SPAM_LOCAL_PARTS = new Set([
  'test', 'demo', 'spam', 'admin', 'noreply', 'no-reply', 'info',
  'hello', 'contact', 'support', 'sales', 'marketing', 'abuse',
  'postmaster', 'webmaster', 'root', 'user', 'guest', 'sample',
  'example', 'fake', 'invalid', 'null', 'none', 'xxx',
]);

export interface SpamResult {
  spam_score: number;
  is_spam: boolean;
  spam_reasons: string[];
}

export interface FeedbackExample {
  name: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  user_decision: boolean;   // true = spam
  user_note: string | null;
}

function heuristicScore(r: ZohoLeadRecord): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (!r.Email && !r.Phone && !r.Mobile) {
    score += 40;
    reasons.push('No email or phone number provided');
  }

  if (r.Email) {
    const email = r.Email.toLowerCase().trim();
    const [local, domain] = email.split('@');
    if (!domain) {
      score += 30;
      reasons.push('Malformed email address');
    } else {
      if (FREE_DOMAINS.has(domain)) {
        score += 20;
        reasons.push('Personal/free email domain (not a business address)');
      }
      if (SPAM_LOCAL_PARTS.has(local)) {
        score += 25;
        reasons.push(`Generic email prefix "${local}" — likely role-based or fake`);
      }
      if (/\d{4,}/.test(local)) {
        score += 10;
        reasons.push('Email address contains a long number sequence');
      }
    }
  }

  const firstName = r.First_Name?.trim() ?? '';
  const lastName  = r.Last_Name?.trim() ?? '';
  const fullName  = `${firstName} ${lastName}`.trim();

  if (!firstName && !lastName) {
    score += 15;
    reasons.push('No name provided');
  } else {
    if (firstName.length === 1 || lastName.length === 1) {
      score += 10;
      reasons.push('Single-character name field');
    }
    if (/\d/.test(fullName)) {
      score += 15;
      reasons.push('Name contains digits');
    }
    if (/(.)\1{3,}/.test(fullName.toLowerCase())) {
      score += 20;
      reasons.push('Name contains repeated characters (e.g. "aaaa")');
    }
  }

  if (!r.Company) {
    score += 10;
    reasons.push('No company name (unusual for a B2B enquiry)');
  }

  return { score: Math.min(score, 100), reasons };
}

async function claudeClassify(
  r: ZohoLeadRecord,
  feedbackExamples: FeedbackExample[] = [],
): Promise<{ is_spam: boolean; reason: string }> {
  const client = new Anthropic();

  const leadSummary = JSON.stringify({
    name:        `${r.First_Name ?? ''} ${r.Last_Name ?? ''}`.trim(),
    email:       r.Email,
    company:     r.Company,
    designation: r.Designation,
    phone:       r.Phone || r.Mobile,
    country:     r.Country,
    lead_source: r.Lead_Source,
    description: r.Description?.slice(0, 300),
  }, null, 2);

  // Build few-shot examples from past team corrections
  let trainingBlock = '';
  if (feedbackExamples.length > 0) {
    const examples = feedbackExamples
      .slice(0, 15)
      .map(ex => {
        const label = ex.user_decision ? 'SPAM' : 'LEGITIMATE';
        const parts = [
          ex.name && `name: "${ex.name}"`,
          ex.email && `email: "${ex.email}"`,
          ex.company && `company: "${ex.company}"`,
          ex.title && `title: "${ex.title}"`,
        ].filter(Boolean).join(', ');
        return `- ${parts} → ${label}${ex.user_note ? ` (team note: "${ex.user_note}")` : ''}`;
      })
      .join('\n');
    trainingBlock = `\n\nPast corrections by the sales team (use these to calibrate your decision):\n${examples}\n`;
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `You are a B2B lead quality analyst for Axis Electrical Products (manufacturer of MCBs, RCDs, switchgear, cable management). Determine if this CRM lead is SPAM or legitimate.${trainingBlock}

Lead to classify:
${leadSummary}

Respond with JSON only: {"is_spam": true/false, "reason": "one sentence"}`,
    }],
  });

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    return { is_spam: false, reason: 'Classification inconclusive — defaulting to legitimate' };
  }
}

export async function analyseSpam(
  r: ZohoLeadRecord,
  feedbackExamples: FeedbackExample[] = [],
): Promise<SpamResult> {
  const { score, reasons } = heuristicScore(r);

  if (score >= 70) return { spam_score: score, is_spam: true,  spam_reasons: reasons };
  if (score <= 20) return { spam_score: score, is_spam: false, spam_reasons: reasons };

  // Borderline — use Claude with team feedback as context
  try {
    const { is_spam, reason } = await claudeClassify(r, feedbackExamples);
    const finalScore = is_spam ? Math.max(score, 65) : Math.min(score, 35);
    return {
      spam_score: finalScore,
      is_spam,
      spam_reasons: is_spam ? [...reasons, reason] : reasons,
    };
  } catch {
    return { spam_score: score, is_spam: score >= 50, spam_reasons: reasons };
  }
}
