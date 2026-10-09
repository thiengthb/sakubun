import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db/db';
import { isAllowedEmail, isGoogleEnabled, isPasswordLoginEnabled } from '@/lib/auth/login-policy';

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
  if (count > 0) {
    throw new APIError('FORBIDDEN', {
      message: 'Đăng ký đã đóng: app này chỉ dành cho một người dùng.',
    });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
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
        before: async (user) => {
          if (!isAllowedEmail(user.email)) throw new APIError('FORBIDDEN', { message: NOT_ALLOWED });
          await assertRegistrationOpen();
        },
        after: async (user) => {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
        },
      },
    },
    // Second lock: even an account already in the DB gets no session unless it is ALLOWED_EMAIL.
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { email: true },
          });
          if (!isAllowedEmail(user?.email)) throw new APIError('FORBIDDEN', { message: NOT_ALLOWED });
        },
      },
    },
  },
  plugins: [admin(), nextCookies()],
});
