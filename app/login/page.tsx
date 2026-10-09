import { LoginForm } from './login-form';
import { allowedEmail, isGoogleEnabled, isPasswordLoginEnabled } from '@/lib/auth/login-policy';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <LoginForm
      googleReady={isGoogleEnabled() && !!allowedEmail()}
      passwordLogin={isPasswordLoginEnabled()}
      error={error ?? null}
    />
  );
}
