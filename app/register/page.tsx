import { RegisterForm } from './register-form';
import { isGoogleEnabled } from '@/lib/google-enabled';

// Google availability resolved server-side at request time (see login/page.tsx).
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return <RegisterForm googleEnabled={isGoogleEnabled()} />;
}
