'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { signUp } from '@/lib/auth/auth-client';
import {
  AuthCard,
  AuthField,
  AuthGoogleAlternative,
  AuthSubmit,
  AuthSwitchLink,
} from '@/components/layout/auth-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Mật khẩu cần ít nhất 8 ký tự');
      return;
    }
    setPending(true);
    const { error } = await signUp.email({ name, email, password, callbackURL: '/' });
    setPending(false);
    if (error) {
      toast.error(error.message ?? 'Đăng ký không thành công');
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard title="Tạo tài khoản" description="Tham gia nhóm học sakubun">
      {sent ? (
        <CardContent className="space-y-4 text-center">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
          <p className="text-sm">
            Đã gửi liên kết xác thực tới <span className="font-medium">{email}</span>. Mở email và
            nhấn vào liên kết để kích hoạt tài khoản, rồi quay lại đăng nhập.
          </p>
          <p className="text-xs text-muted-foreground">
            Chưa thấy email? Kiểm tra hộp thư rác. Bạn cũng có thể thử đăng nhập — hệ thống sẽ gửi
            lại liên kết.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Tới trang đăng nhập</Link>
          </Button>
        </CardContent>
      ) : (
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <AuthField
              id="name"
              label="Tên hiển thị"
              autoComplete="name"
              value={name}
              onChange={setName}
              placeholder="Tên của bạn"
            />
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
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="Ít nhất 8 ký tự"
            />
            <AuthSubmit pending={pending}>Đăng ký</AuthSubmit>
          </form>
          <AuthGoogleAlternative enabled={googleEnabled} />
          <AuthSwitchLink prompt="Đã có tài khoản?" href="/login" label="Đăng nhập" />
        </CardContent>
      )}
    </AuthCard>
  );
}
