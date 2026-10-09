import { LoginForm } from './login-form';
import { isGoogleEnabled } from '@/lib/google-enabled';
import { isRegistrationOpen } from '@/lib/registration';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  return (
    <LoginForm googleEnabled={isGoogleEnabled()} registrationOpen={await isRegistrationOpen()} />
  );
}
