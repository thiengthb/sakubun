import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { RegisterForm } from './register-form';
import { Button } from '@/components/ui/button';
import { isGoogleEnabled } from '@/lib/auth/google-enabled';
import { isRegistrationOpen } from '@/lib/auth/registration';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (!(await isRegistrationOpen())) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="font-heading text-lg font-semibold">Đăng ký đã đóng</h1>
        <p className="text-sm text-muted-foreground">
          sakubun này chỉ dành cho một người dùng, và tài khoản đó đã được tạo. Nếu đó là bạn, hãy
          đăng nhập.
        </p>
        <Button asChild>
          <Link href="/login">Đăng nhập</Link>
        </Button>
      </main>
    );
  }

  return <RegisterForm googleEnabled={isGoogleEnabled()} />;
}
