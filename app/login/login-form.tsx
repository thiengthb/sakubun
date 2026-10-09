'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signIn } from '@/lib/auth/auth-client';
import {
  AuthCard,
  AuthField,
  AuthGoogleAlternative,
  AuthSubmit,
  AuthSwitchLink,
} from '@/components/layout/auth-card';
import { CardContent } from '@/components/ui/card';

export function LoginForm({
  googleEnabled,
  registrationOpen,
}: {
  googleEnabled: boolean;
  registrationOpen: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await signIn.email({ email, password, callbackURL: '/' });
    setPending(false);
    if (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        toast.info('Email chưa được xác thực', {
          description: `Đã gửi lại liên kết xác thực tới ${email}. Mở email và nhấn vào liên kết rồi đăng nhập lại.`,
        });
        return;
      }
      toast.error(error.message ?? 'Đăng nhập không thành công');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AuthCard title="Đăng nhập sakubun" description="Luyện dịch Nhật–Việt qua MCP">
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            placeholder="ban@example.com"
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
        <AuthGoogleAlternative enabled={googleEnabled} />
        {registrationOpen && (
          <AuthSwitchLink prompt="Chưa có tài khoản?" href="/register" label="Đăng ký" />
        )}
      </CardContent>
    </AuthCard>
  );
}
