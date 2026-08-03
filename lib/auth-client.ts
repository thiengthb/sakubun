// Browser-side better-auth client — the login/register/logout UI calls these to talk to the
// /api/auth route. Same-origin, so no baseURL is needed. The admin-plugin client (ban/revoke views)
// is added in a later slice; this covers email sign-in / sign-up / sign-out and useSession.
import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // Mirrors the server's admin() plugin so the operator UI has typed ban/unban/revoke calls.
  plugins: [adminClient()],
});
export const { signIn, signUp, signOut, useSession } = authClient;
