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
    <AuthCard title="Đăng nhập sakubun" description="Luyện dịch Nhật–Việt qua MCP">
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-body text-destructive">
            Không đăng nhập được. sakubun chỉ cho phép một tài khoản Google đã được chỉ định.
          </p>
        )}
        {googleReady ? (
          <GoogleSignInButton label="Đăng nhập với Google" />
        ) : (
          <p className="text-center text-subhead text-muted-foreground">
            Chưa cấu hình đăng nhập Google. Cần đặt GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và
            ALLOWED_EMAIL cho server.
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
