import { LoginForm } from './login-form';
import { isGoogleEnabled } from '@/lib/auth/google-enabled';
import { isRegistrationOpen } from '@/lib/auth/registration';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  return (
    <LoginForm googleEnabled={isGoogleEnabled()} registrationOpen={await isRegistrationOpen()} />
  );
}
