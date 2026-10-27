import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, jwt } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { mcp } from '@better-auth/mcp';
import { prisma } from '@/lib/db/db';
import { accountAccess } from '@/lib/auth/access';
import {
  isAllowedEmail,
  isGoogleEnabled,
  isPasswordLoginEnabled,
  maxAccounts,
} from '@/lib/auth/login-policy';
import { userDb } from '@/lib/db/user-db';
import { loadStarterDeck, seedStarterDeck } from '@/lib/import/starter-deck';
import { isAllowedRedirectUri } from '@/lib/auth/oauth-redirects';
import { APP_URL } from '@/lib/core/app-url';

// The OAuth provider needs a fixed base URL: it is the token issuer.
const BASE_URL = APP_URL;

// The MCP endpoint as claude.ai and ChatGPT see it; OAuth tokens are issued for this audience only.
export const MCP_RESOURCE = new URL('/api/mcp', BASE_URL).href;

// Who signs those tokens: better-auth under its default /api/auth base path.
export const AUTH_ISSUER = new URL('/api/auth', BASE_URL).href;

const NOT_ALLOWED = 'Tài khoản này không được phép dùng sakubun.';

async function assertRegistrationOpen(): Promise<void> {
  let count: number;
  try {
    count = await prisma.user.count();
  } catch {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Không kiểm tra được trạng thái đăng ký. Thử lại sau.',
    });
  }
  if (count >= maxAccounts()) {
    throw new APIError('FORBIDDEN', { message: 'sakubun đã đủ người dùng.' });
  }
}

// A new learner starts with their own OpenJLPT deck (roadmap 7.2). Without it the account is useless,
// so a failure takes the account back out and the next sign-in tries again from scratch.
async function giveStarterDeck(userId: string): Promise<void> {
  try {
    await seedStarterDeck(userDb(userId), await loadStarterDeck());
  } catch (e) {
    console.error('[auth] starter deck failed', e);
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Không tạo được tài khoản. Thử lại sau.',
    });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: BASE_URL,
  trustedOrigins: [
    'http://localhost:3789',
    'https://sakubun.thientnse.site',
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  // Google is the only way in. Password login is a test-only door (see login-policy.ts).
  emailAndPassword: { enabled: isPasswordLoginEnabled() },
  ...(isGoogleEnabled()
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            prompt: 'select_account' as const,
          },
        },
      }
    : {}),
  onAPIError: { errorURL: '/login' },
  databaseHooks: {
    user: {
      create: {
        // Anyone may sign up (roadmap 7.2d) until MAX_ACCOUNTS; thien bans from /admin.
        before: async () => {
          await assertRegistrationOpen();
        },
        after: async (user) => {
          const admin = isAllowedEmail(user.email);
          await prisma.user.update({
            where: { id: user.id },
            data: { role: admin ? 'admin' : 'user' },
          });
          // The admin keeps the deck they already have (or imports it); learners get theirs now.
          if (!admin) await giveStarterDeck(user.id);
        },
      },
    },
    // A banned account, or one whose role the app does not know, gets no session.
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { email: true, role: true, banned: true },
          });
          if (accountAccess(user) === 'none')
            throw new APIError('FORBIDDEN', { message: NOT_ALLOWED });
        },
      },
    },
  },
  plugins: [
    admin(),
    // Signs the OAuth access tokens; its keys live in the jwks table, so there is no new secret.
    jwt(),
    // OAuth for /api/mcp (roadmap 4.1): claude.ai and ChatGPT register themselves (DCR), the learner signs in
    // on /login as usual and approves on /consent. Codes only go to the hosts in oauth-redirects.ts.
    mcp({
      loginPage: '/login',
      consentPage: '/consent',
      resource: MCP_RESOURCE,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // No client_credentials: every token comes from a learner signing in and approving.
      grantTypes: ['authorization_code', 'refresh_token'],
      validateRedirectUri: (uri, _registered, exactMatch) =>
        exactMatch && isAllowedRedirectUri(uri),
    }),
    nextCookies(),
  ],
});
