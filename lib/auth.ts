import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';
import { notifyAdmins } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

// Google sign-in is enabled ONLY when both credentials are present in env (GOOGLE_CLIENT_ID +
// GOOGLE_CLIENT_SECRET, set in the gitignored .env.docker). Otherwise the provider is omitted so the
// app never boots a half-configured OAuth flow. The client mirrors this with NEXT_PUBLIC_GOOGLE_ENABLED
// to decide whether to render the "Sign in with Google" button.
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Central auth for the deployed multi-user sakubun (plan 2026-07-21). better-auth is a vetted
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
  // Email + password. Sign-up is OPEN for now (small trusted friend group) via /register; invite-only
  // gating is a deferred refinement (plan 2026-07-21, out of scope v1). requireEmailVerification =
  // no session until the address is proven, so a typo'd / someone-else's email can't own an account
  // (2026-07-22). Accounts that predate this are grandfathered verified by the
  // 20260722090000_grandfather_email_verified migration, so it does not lock out existing users.
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
  // Bootstrap the operator as admin (the ban/revoke kill-switch owner). Two triggers, checked on every
  // user create: (1) the CANONICAL admin — a user whose email equals ADMIN_EMAIL — always becomes admin,
  // on ANY machine, so a fresh deploy or a cross-machine restore always ends up with the same admin
  // identity without a manual step (cross-machine sync, 2026-07-24; email is the stable identity — see
  // docs/decisions.md); (2) fallback for when ADMIN_EMAIL is unset — the FIRST account created becomes
  // admin. Everyone else is a normal member. Idempotent: only runs on create, only promotes.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          const isCanonicalAdmin = !!adminEmail && user.email.trim().toLowerCase() === adminEmail;
          const isFirstUser = !adminEmail && (await prisma.user.count()) === 1;
          if (isCanonicalAdmin || isFirstUser)
            await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
          // Tell the operators someone joined. Runs AFTER the promotion above so the very first
          // account does not notify itself about its own creation. Passenger: a failure here must
          // never break sign-up, which is the one flow a new user cannot retry around.
          if (!isCanonicalAdmin && !isFirstUser) {
            await notifyAdmins({
              kind: 'USER_REGISTERED',
              title: `${user.name || user.email} vừa tạo tài khoản`,
              pluralTitle: (n) => `${n} tài khoản mới vừa được tạo`,
              body: user.email,
              href: '/admin',
              entityId: user.id,
              actorName: user.name || null,
            }).catch(() => null);
          }
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
