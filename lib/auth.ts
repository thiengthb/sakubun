import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

/**
 * THE door. This app is single-user and reachable from the public internet, so account creation is
 * open exactly until the one account exists, then closed for good.
 *
 * Enforced on `user.create` — the single choke point EVERY sign-up path funnels through (email +
 * password AND Google OAuth). Hiding the /register form or gating the server action would leave the
 * OAuth callback as an open side door; this cannot be walked around from outside.
 *
 * Fail-closed: if the count query throws we refuse rather than allow, because the failure mode of
 * allowing is a stranger with an account on your data.
 */
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

// Google sign-in is enabled ONLY when both credentials are present in env (GOOGLE_CLIENT_ID +
// GOOGLE_CLIENT_SECRET, set in the gitignored .env.docker). Otherwise the provider is omitted so the
// app never boots a half-configured OAuth flow. The client mirrors this with NEXT_PUBLIC_GOOGLE_ENABLED
// to decide whether to render the "Sign in with Google" button.
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Central auth for the deployed SINGLE-USER sakubun. better-auth is a vetted
// library (scrypt hashing, session + rate-limit built in) — it honours the platform "never
// hand-roll login/hash/JWT/session" rule in spirit; Authentik (the usual gate) lives on the
// down NUC and is wrong for a machine MCP client anyway. Uses the SAME shared Prisma instance
// from lib/db.ts. Secret + base URL come from env (BETTER_AUTH_SECRET / BETTER_AUTH_URL).
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  // baseURL is the public domain (correct for prod cookies/callbacks), but the operator also reaches
  // the app on the host itself — trust localhost:3789 too so login/register work there, not only
  // through the tunnel. Extra origins can be added via BETTER_AUTH_TRUSTED_ORIGINS (comma-separated).
  trustedOrigins: [
    'http://localhost:3789',
    'https://sakubun.thientnse.site',
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  // Email + password. Sign-up is CLOSED once the one account exists — see assertRegistrationOpen,
  // which runs on the user.create hook below. requireEmailVerification = no session until the address
  // is proven. Accounts that predate this are grandfathered verified by the
  // 20260722090000_grandfather_email_verified migration.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Forgot-password flow: emails a reset link (valid 1h) via SMTP. The link lands on /reset-password
    // with a validated token; the page then calls resetPassword. Same SMTP path as verification, so it
    // needs SMTP_* configured to actually deliver.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Đặt lại mật khẩu sakubun',
        text:
          `Chào ${user.name},\n\n` +
          `Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu. Nhấn vào liên kết dưới đây để đặt mật khẩu mới:\n${url}\n\n` +
          `Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không đổi.`,
        html:
          `<p>Chào ${user.name},</p>` +
          `<p>Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu. Nhấn vào liên kết dưới đây để đặt mật khẩu mới:</p>` +
          `<p><a href="${url}">Đặt lại mật khẩu</a></p>` +
          `<p>Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không đổi.</p>`,
      });
    },
  },
  // Google OAuth (only when configured — see googleConfigured). A Google account arrives with a
  // provider-verified email, so it satisfies requireEmailVerification without the email step.
  ...(googleConfigured
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        },
        // Link a Google sign-in to an existing email/password account with the SAME email instead of
        // erroring — Google's verified email makes this safe (trustedProviders). So a user who
        // registered with email can later use "Sign in with Google" and land on the same account.
        account: {
          accountLinking: { enabled: true, trustedProviders: ['google'] },
        },
      }
    : {}),
  // Send the verification link on sign-up AND re-send it when an unverified user tries to sign in (so a
  // lost first mail self-heals on the next login attempt). autoSignInAfterVerification = clicking the
  // link both verifies and logs them in, landing on the callbackURL. The mail itself goes out via
  // lib/email.ts (SMTP) — if SMTP is unconfigured it is logged, not thrown, so sign-up never 500s.
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Xác thực email cho sakubun',
        text:
          `Chào ${user.name},\n\n` +
          `Nhấn vào liên kết dưới đây để xác thực email và kích hoạt tài khoản sakubun của bạn:\n${url}\n\n` +
          `Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.`,
        html:
          `<p>Chào ${user.name},</p>` +
          `<p>Nhấn vào liên kết dưới đây để xác thực email và kích hoạt tài khoản sakubun của bạn:</p>` +
          `<p><a href="${url}">Xác thực email</a></p>` +
          `<p>Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.</p>`,
      });
    },
  },
  // The registration gate (before) and the operator bootstrap (after). There is exactly one account,
  // so the old ADMIN_EMAIL / first-user-wins branching has nothing left to decide.
  databaseHooks: {
    user: {
      create: {
        // Runs before the row is written, for every sign-up path. See assertRegistrationOpen.
        before: async () => {
          await assertRegistrationOpen();
        },
        // The one account IS the operator, so it gets the admin role. No "is this the first user?"
        // branch and nobody to notify: assertRegistrationOpen guarantees there is never a second.
        after: async (user) => {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
        },
      },
    },
  },
  plugins: [
    // Operator control plane: ban / suspend / revoke sessions + roles. A banned user loses web
    // AND MCP access immediately (every request authorises against this central DB) — the whole
    // reason this app is centralized rather than self-hosted.
    admin(),
    // MUST stay last: lets better-auth set cookies from Server Actions / Server Components.
    nextCookies(),
  ],
  // NOTE: per-user MCP tokens are NOT the @better-auth/api-key plugin (its peer deps pin
  // better-call/@better-auth/utils exact + pull zod v4, conflicting with this app's zod v3).
  // Instead a small custom `McpKey` model (prisma/schema.prisma) holds a SHA-256 hash of each
  // user's personal token; the MCP route verifies the bearer + rejects a banned user. Same
  // bearer-token-for-a-machine-endpoint pattern todo/yakudoku already use. Phase 2 batch 4.
});
