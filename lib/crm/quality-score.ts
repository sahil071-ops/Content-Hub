/**
 * Lead quality scoring — pure logic, no external dependencies.
 * Can be imported both server-side and client-side.
 *
 * Returns a score 0–100 and a breakdown of each factor so the UI
 * can explain exactly WHY a lead is (or isn't) high-value.
 */

const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.in', 'outlook.com', 'outlook.in',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'rediffmail.com', 'ymail.com', 'aol.com', 'protonmail.com', 'proton.me',
  'tutanota.com', 'zohomail.com',
]);

const SENIOR_KEYWORDS = [
  'director', 'manager', 'vp', 'vice president', 'ceo', 'coo', 'cto',
  'president', 'owner', 'founder', 'head', 'chief', 'principal', 'partner',
  'procurement', 'purchase', 'buyer', 'engineer', 'consultant', 'lead',
];

export interface QualityFactor {
  label: string;
  description: string;
  max: number;      // max points this factor can contribute
  earned: number;   // actual points earned
  met: boolean;
}

export interface QualityBreakdown {
  score: number;
  is_high_value: boolean;
  factors: QualityFactor[];
}

interface LeadLike {
  email?: string | null;
  company?: string | null;
  phone?: string | null;
  mobile?: string | null;
  title?: string | null;
  website?: string | null;
  country?: string | null;
}

export function computeQualityBreakdown(lead: LeadLike): QualityBreakdown {
  const factors: QualityFactor[] = [];

  // ── Email presence ────────────────────────────────────────────
  const hasEmail = !!lead.email;
  factors.push({
    label: 'Has email address',
    description: 'A contact email was provided.',
    max: 20,
    earned: hasEmail ? 20 : 0,
    met: hasEmail,
  });

  // ── Business email domain ─────────────────────────────────────
  let isBusinessEmail = false;
  if (lead.email) {
    const domain = lead.email.split('@')[1]?.toLowerCase() ?? '';
    isBusinessEmail = !!domain && !FREE_DOMAINS.has(domain);
  }
  factors.push({
    label: 'Business email domain',
    description: 'Email is from a company domain, not a free provider like Gmail or Yahoo.',
    max: 15,
    earned: isBusinessEmail ? 15 : 0,
    met: isBusinessEmail,
  });

  // ── Company name ──────────────────────────────────────────────
  const hasCompany = !!lead.company;
  factors.push({
    label: 'Company name provided',
    description: 'The lead is associated with a company — essential for B2B qualification.',
    max: 20,
    earned: hasCompany ? 20 : 0,
    met: hasCompany,
  });

  // ── Phone / mobile ────────────────────────────────────────────
  const hasPhone = !!(lead.phone || lead.mobile);
  factors.push({
    label: 'Phone number provided',
    description: 'A phone or mobile number makes it easier to follow up directly.',
    max: 15,
    earned: hasPhone ? 15 : 0,
    met: hasPhone,
  });

  // ── Job title ─────────────────────────────────────────────────
  const hasTitle = !!lead.title;
  factors.push({
    label: 'Job title / designation',
    description: 'Knowing their role helps assess decision-making authority.',
    max: 10,
    earned: hasTitle ? 10 : 0,
    met: hasTitle,
  });

  // ── Senior role ───────────────────────────────────────────────
  let isSenior = false;
  if (lead.title) {
    const t = lead.title.toLowerCase();
    isSenior = SENIOR_KEYWORDS.some(k => t.includes(k));
  }
  factors.push({
    label: 'Decision-maker role',
    description: `Title suggests purchasing authority (e.g. Director, Manager, Engineer, Procurement).`,
    max: 10,
    earned: isSenior ? 10 : 0,
    met: isSenior,
  });

  // ── Website ───────────────────────────────────────────────────
  const hasWebsite = !!lead.website;
  factors.push({
    label: 'Company website',
    description: 'A website confirms the company exists and can be researched.',
    max: 5,
    earned: hasWebsite ? 5 : 0,
    met: hasWebsite,
  });

  // ── Country ───────────────────────────────────────────────────
  const hasCountry = !!lead.country;
  factors.push({
    label: 'Country / location',
    description: 'Geographic data helps route the lead to the right sales team.',
    max: 5,
    earned: hasCountry ? 5 : 0,
    met: hasCountry,
  });

  const score = Math.min(factors.reduce((s, f) => s + f.earned, 0), 100);

  return {
    score,
    is_high_value: score >= 60,
    factors,
  };
}

/** Convenience — just the score number. Used server-side during pull. */
export function computeQualityScore(lead: LeadLike): number {
  return computeQualityBreakdown(lead).score;
}
