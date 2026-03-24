/**
 * Lead enrichment using Claude.
 *
 * For high-value leads (quality_score >= 60), generates:
 * - Company summary & context
 * - Likely use case for Axis electrical products
 * - Recommended product categories to pitch
 * - Talking points tailored to their role
 * - Follow-up suggestion
 * - Deal potential estimate
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Lead, LeadEnrichment } from '@/types/database';

interface EnrichmentOutput {
  company_summary: string;
  likely_use_case: string;
  recommended_products: string[];
  talking_points: string[];
  follow_up_suggestion: string;
  deal_potential: 'low' | 'medium' | 'high';
  notes: string;
}

export async function enrichLead(lead: Lead): Promise<Omit<LeadEnrichment, 'id' | 'lead_id' | 'generated_at'>> {
  const client = new Anthropic();

  const context = {
    name: [lead.first_name, lead.last_name].filter(Boolean).join(' '),
    email: lead.email,
    company: lead.company,
    title: lead.title,
    phone: lead.phone || lead.mobile,
    country: lead.country,
    website: lead.website,
    industry: lead.industry,
    lead_source: lead.lead_source,
    lead_status: lead.lead_status,
    description: lead.description?.slice(0, 500),
  };

  const prompt = `You are a senior sales intelligence analyst for Axis Electrical Products, a manufacturer of electrical distribution and protection equipment (MCBs, RCDs, DBs, isolators, HSTs, bus bars, cable management, switchgear).

A promising lead has come in. Analyse it and generate actionable sales intelligence.

Lead profile:
${JSON.stringify(context, null, 2)}

Respond with a JSON object matching this exact structure:
{
  "company_summary": "2-3 sentence overview of what this company likely does and their electrical infrastructure needs",
  "likely_use_case": "The most probable reason they're interested — what projects or applications would they have?",
  "recommended_products": ["array", "of", "3-5", "Axis product categories most relevant to this lead"],
  "talking_points": ["array", "of", "4-5", "specific talking points tailored to their role and industry"],
  "follow_up_suggestion": "Specific recommendation for how and when to follow up",
  "deal_potential": "low|medium|high — based on company size signals, role seniority, and industry",
  "notes": "Any red flags, opportunities, or context the sales team should know"
}

Return JSON only, no markdown.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as EnrichmentOutput;

  return {
    company_summary:      parsed.company_summary ?? null,
    likely_use_case:      parsed.likely_use_case ?? null,
    recommended_products: Array.isArray(parsed.recommended_products) ? parsed.recommended_products : [],
    talking_points:       Array.isArray(parsed.talking_points) ? parsed.talking_points : [],
    follow_up_suggestion: parsed.follow_up_suggestion ?? null,
    deal_potential:       (['low', 'medium', 'high'] as const).includes(parsed.deal_potential)
                            ? parsed.deal_potential
                            : null,
    notes:                parsed.notes ?? null,
    raw_response:         { model: 'claude-sonnet-4-6', text: parsed },
  };
}
