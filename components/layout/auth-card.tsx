'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthNav } from '@/components/layout/auth-nav';
import { GoogleSignInButton } from '@/components/layout/google-signin-button';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The full-page shell both /login and /register render: nav bar, centred card, titled header.
export function AuthCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <AuthNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {children}
        </Card>
      </main>
    </div>
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
      <Input
        id={id}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </div>
  );
}

export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

// Google sign-in below an "hoặc" rule. Renders nothing when the provider is off, so callers do not
// each repeat the `googleEnabled &&` guard around a four-element divider.
export function AuthGoogleAlternative({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        hoặc
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleSignInButton />
    </>
  );
}

export function AuthSwitchLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-4 text-center text-sm text-muted-foreground">
      {prompt}{' '}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4">
        {label}
      </Link>
    </p>
  );
}
