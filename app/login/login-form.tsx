'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { signIn } from '@/lib/auth-client';
import { AuthNav } from '@/components/shell/auth-nav';
import { GoogleSignInButton } from '@/components/shell/google-signin-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * `googleEnabled` is resolved on the SERVER at request time (page.tsx reads GOOGLE_CLIENT_ID) and passed
 * in — NOT a NEXT_PUBLIC build-time flag. In the Docker build, `next build` never sees the runtime
 * .env.docker, so a NEXT_PUBLIC_* value bakes in as false; a server-resolved prop is correct at runtime.
 */
export function LoginForm({
  googleEnabled,
  registrationOpen,
}: {
  googleEnabled: boolean;
  /** Single-user app: the sign-up link only makes sense while THE account does not exist yet. */
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
      // Unverified account: better-auth (sendOnSignIn) has just re-sent the verification link, so
      // point the user at their inbox instead of showing a generic failure.
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
    <div className="flex min-h-svh flex-col">
      <AuthNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            {/* No brand mark here — the logo already sits in the top nav (AuthNav). */}
            <CardTitle className="text-xl">Đăng nhập sakubun</CardTitle>
            <CardDescription>Luyện dịch Nhật–Việt qua Claude Desktop</CardDescription>
          </CardHeader>
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
              {/* Grid, not flex, so DOM order can differ from visual order. The link used to sit
                  between the two inputs in the DOM, so tabbing out of Email landed on "Quên mật
                  khẩu?" BEFORE the password field — a keyboard user was thrown out of the form
                  mid-entry (WCAG 2.4.3). DOM order is now Label -> Input -> Link while the link
                  still renders up on the label row. min-h-6 gets it to the 24px target floor
                  (SC 2.5.8); it measured 94x16. */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2">
                <Label htmlFor="password" className="col-start-1 row-start-1">
                  Mật khẩu
                </Label>
                {/* Grid placement goes on `wrapperClassName`, never on `className`: Input renders a
                    `relative w-full` wrapper (it hosts the clear ×), so `className` lands on the
                    native field inside while the wrapper — the real grid item — stays in column 1
                    beside the link. That left this field 100px narrower than Email with every gate
                    green. The locked pattern `input-clear-affordance` already says sizing belongs on
                    wrapperClassName; this is that rule, not a new one. */}
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  wrapperClassName="col-span-2 row-start-2"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Đăng nhập
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
            {registrationOpen && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Chưa có tài khoản?{' '}
                <Link
                  href="/register"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Đăng ký
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
