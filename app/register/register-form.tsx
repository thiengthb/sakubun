'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { signUp } from '@/lib/auth-client';
import { AuthNav } from '@/components/shell/auth-nav';
import { GoogleSignInButton } from '@/components/shell/google-signin-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="flex min-h-svh flex-col">
      <AuthNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">Tạo tài khoản</CardTitle>
            <CardDescription>Tham gia nhóm học sakubun</CardDescription>
          </CardHeader>
          {sent ? (
            <CardContent className="space-y-4 text-center">
              <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
              <p className="text-sm">
                Đã gửi liên kết xác thực tới <span className="font-medium">{email}</span>. Mở email
                và nhấn vào liên kết để kích hoạt tài khoản, rồi quay lại đăng nhập.
              </p>
              <p className="text-xs text-muted-foreground">
                Chưa thấy email? Kiểm tra hộp thư rác. Bạn cũng có thể thử đăng nhập — hệ thống sẽ
                gửi lại liên kết.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Tới trang đăng nhập</Link>
              </Button>
            </CardContent>
          ) : (
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên hiển thị</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên của bạn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ít nhất 8 ký tự"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Đăng ký
                </Button>
              </form>
              {googleEnabled && (
                <>
                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    hoặc
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <GoogleSignInButton />
                </>
              )}
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Đã có tài khoản?{' '}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Đăng nhập
                </Link>
              </p>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}
