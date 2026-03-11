'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { APP_NAME, VERSION } from '@/lib/version';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError === 'auth_callback_error'
      ? 'The sign-in link has expired or already been used. Please request a new one.'
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/library`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500" />
          <h2 className="font-semibold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500">
            We've sent a sign-in link to <strong>{email}</strong>.
            Click the link in the email to sign in.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => { setSent(false); setEmail(''); }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Sign in</h2>
            <p className="text-sm text-gray-500">
              Enter your company email and we'll send you a sign-in link.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              'Send sign-in link'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fafb] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2323A3] mb-4">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Internal content repository</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-xl border shadow-sm p-6 flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-gray-400 mt-6">
          {APP_NAME} v{VERSION} · Access is restricted to authorised users only.
        </p>
      </div>
    </div>
  );
}
