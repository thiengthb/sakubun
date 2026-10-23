import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';

// oauthProviderClient carries the signed authorize query from /login and /consent into sign-in and
// consent calls, so a claude.ai or ChatGPT connection resumes after thien signs in.
export const authClient = createAuthClient({
  plugins: [adminClient(), oauthProviderClient()],
});
export const { signIn, signOut, useSession } = authClient;
