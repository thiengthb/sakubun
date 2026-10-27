'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AppLogo } from '@/components/layout/app-logo';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The full-page shell of /login and /consent: the app's mark as the sidebar shows it, then one
// card. No nav bar: there is nowhere to go before signing in.
export function AuthCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <AppLogo />
          <div className="min-w-0">
            <p className="text-base leading-tight font-extrabold">Sakubun</p>
            <p className="text-xs text-muted-foreground">Luyện dịch Nhật–Việt</p>
          </div>
        </div>
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          {children}
        </Card>
        <p className="flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline underline-offset-4">
            Chính sách bảo mật
          </Link>
          <Link href="/terms" className="underline underline-offset-4">
            Điều khoản sử dụng
          </Link>
        </p>
      </div>
    </main>
  );
}

export function AuthField({
  id,
  label,
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> & {
  id: string;
  label: ReactNode;
  value: string;
  // Takes the value, not the event: every caller here binds straight to a useState setter.
  onChange: (value: string) => void;
}) {
  return (
    <div className={className ?? 'space-y-2'}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}

export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
