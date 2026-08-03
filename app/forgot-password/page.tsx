'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { AuthNav } from '@/components/shell/auth-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  // Show the same "check your inbox" screen whether or not the email exists — never reveal which
  // addresses have an account (account-enumeration hygiene).
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    // redirectTo = the page the validated reset link lands on (with ?token=...).
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? 'Không gửi được email đặt lại mật khẩu');
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
            <CardTitle className="text-xl">Quên mật khẩu</CardTitle>
            <CardDescription>Nhập email để nhận liên kết đặt lại mật khẩu</CardDescription>
          </CardHeader>
          {sent ? (
            <CardContent className="space-y-4 text-center">
              <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
              <p className="text-sm">
                Nếu <span className="font-medium">{email}</span> có tài khoản, chúng tôi đã gửi một
                liên kết đặt lại mật khẩu. Mở email và nhấn vào liên kết (hiệu lực 1 giờ).
              </p>
              <p className="text-xs text-muted-foreground">
                Chưa thấy email? Kiểm tra hộp thư rác.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Về trang đăng nhập</Link>
              </Button>
            </CardContent>
          ) : (
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Gửi liên kết đặt lại
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Nhớ ra rồi?{' '}
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
