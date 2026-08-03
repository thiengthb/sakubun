'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { AuthNav } from '@/components/shell/auth-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // better-auth's /reset-password/:token callback validates the token and redirects here with either
  // ?token=<valid> or ?error=INVALID_TOKEN.
  const token = params.get('token');
  const invalid = params.get('error') === 'INVALID_TOKEN' || !token;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Mật khẩu cần ít nhất 8 ký tự');
      return;
    }
    if (password !== confirm) {
      toast.error('Mật khẩu nhập lại không khớp');
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (error) {
      toast.error(error.message ?? 'Không đặt lại được mật khẩu');
      return;
    }
    toast.success('Đã đổi mật khẩu. Hãy đăng nhập lại.');
    router.push('/login');
  }

  if (invalid) {
    return (
      <CardContent className="space-y-4 text-center">
        <TriangleAlert className="mx-auto size-10 text-warn" aria-hidden />
        <p className="text-sm">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
        </Button>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu mới</Label>
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
        <div className="space-y-2">
          <Label htmlFor="confirm">Nhập lại mật khẩu</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Đặt lại mật khẩu
        </Button>
      </form>
    </CardContent>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <AuthNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">Đặt lại mật khẩu</CardTitle>
            <CardDescription>Chọn một mật khẩu mới cho tài khoản của bạn</CardDescription>
          </CardHeader>
          {/* useSearchParams requires a Suspense boundary in the App Router. */}
          <Suspense
            fallback={
              <CardContent className="text-center text-sm text-muted-foreground">
                Đang tải…
              </CardContent>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </Card>
      </main>
    </div>
  );
}
