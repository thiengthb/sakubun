'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signIn } from '@/lib/auth/auth-client';
import { AuthCard, AuthField, AuthSubmit } from '@/components/layout/auth-card';
import { GoogleSignInButton } from '@/components/layout/google-signin-button';
import { CardContent } from '@/components/ui/card';

export function LoginForm({
  googleReady,
  passwordLogin,
  error,
}: {
  googleReady: boolean;
  passwordLogin: boolean;
  error: string | null;
}) {
  return (
    <AuthCard title="Đăng nhập" description="Đăng nhập hoặc tạo tài khoản bằng Google.">
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-sm bg-alert-wash px-3 py-2 text-sm text-destructive">
            Tài khoản này không được phép vào Sakubun.
          </p>
        )}
        {googleReady ? (
          <GoogleSignInButton label="Đăng nhập với Google" />
        ) : (
          <p className="rounded-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
            Server chưa cấu hình đăng nhập Google (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).
          </p>
        )}
        {passwordLogin && <TestPasswordForm />}
      </CardContent>
    </AuthCard>
  );
}

// Test-only (never rendered in a production build): lets Playwright sign in without Google.
function TestPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { data, error } = await signIn.email({ email, password, callbackURL: '/' });
    setPending(false);
    if (error) {
      toast.error(error.message ?? 'Đăng nhập không thành công');
      return;
    }
    // The auth client already follows a redirect answer: '/' normally, or the OAuth authorize step
    // when claude.ai or ChatGPT sent thien here to connect.
    if (data?.redirect) return;
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <AuthField
        id="password"
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <AuthSubmit pending={pending}>Đăng nhập</AuthSubmit>
    </form>
  );
}
