import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db/db';
import { sendEmail } from '@/lib/auth/email';

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

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    'http://localhost:3789',
    'https://sakubun.thientnse.site',
    'sakubun://',
    ...(process.env.NODE_ENV === 'development' ? ['exp://'] : []),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
  ...(googleConfigured
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        },
        account: {
          accountLinking: { enabled: true, trustedProviders: ['google'] },
        },
      }
    : {}),
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
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          await assertRegistrationOpen();
        },
        after: async (user) => {
          await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
        },
      },
    },
  },
  plugins: [
    admin(),
    expo(),
    nextCookies(),
  ],
});
