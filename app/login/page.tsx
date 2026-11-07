import { LoginForm } from './login-form';
import { loginErrorText } from '@/lib/auth/login-error';
import { safeReturnPath } from '@/lib/auth/login-return';
import { allowedEmail, isGoogleEnabled, isPasswordLoginEnabled } from '@/lib/auth/login-policy';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <LoginForm
      googleReady={isGoogleEnabled() && !!allowedEmail()}
      passwordLogin={isPasswordLoginEnabled()}
      error={loginErrorText(error)}
      next={safeReturnPath(next)}
    />
  );
}
