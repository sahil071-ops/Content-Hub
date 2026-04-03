/**
 * Email verification via Abstract API.
 * Free tier: 100 verifications/day.
 * Docs: https://www.abstractapi.com/api/email-verification-validation-api
 */

export interface EmailVerificationResult {
  email_valid: boolean;
  email_disposable: boolean;
  email_deliverable: boolean;
}

export async function verifyEmail(email: string): Promise<EmailVerificationResult | null> {
  const apiKey = process.env.ABSTRACT_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      deliverability?: string;
      is_valid_format?: { value: boolean };
      is_disposable_email?: { value: boolean };
    };

    return {
      email_valid:       data.is_valid_format?.value ?? false,
      email_disposable:  data.is_disposable_email?.value ?? false,
      email_deliverable: data.deliverability === 'DELIVERABLE',
    };
  } catch {
    return null;
  }
}
