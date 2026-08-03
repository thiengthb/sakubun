import { LoginForm } from './login-form';
import { isGoogleEnabled } from '@/lib/google-enabled';

// Resolve Google availability on the server at REQUEST time (not a NEXT_PUBLIC build-time flag — see
// login-form.tsx). force-dynamic so the env is read at runtime, where .env.docker is present.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm googleEnabled={isGoogleEnabled()} />;
}
