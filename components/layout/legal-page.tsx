import { type ReactNode } from 'react';
import Link from 'next/link';
import { AppLogo } from '@/components/layout/app-logo';

// /privacy and /terms: public pages Google's consent screen links to, readable before signing in.
// Same mark as the auth pages, then plain text; no nav bar, like /login.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/login" className="mb-8 flex w-fit items-center gap-2">
        <AppLogo />
        <span className="min-w-0">
          <span className="block text-base leading-tight font-extrabold">Sakubun</span>
          <span className="block text-xs text-muted-foreground">Luyện dịch Nhật–Việt</span>
        </span>
      </Link>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Cập nhật {updated}</p>
      <div className="mt-6 space-y-6 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-sm whitespace-nowrap text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-4">
          Chính sách bảo mật
        </Link>
        <Link href="/terms" className="underline underline-offset-4">
          Điều khoản sử dụng
        </Link>
        <Link href="/login" className="underline underline-offset-4">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}

/** The admin's address (ALLOWED_EMAIL) as the contact; set on the server, never in the repo. */
export function ContactLine({ email }: { email: string | null }) {
  return email ? (
    <a href={`mailto:${email}`} className="underline underline-offset-4">
      {email}
    </a>
  ) : (
    <>email hỗ trợ ghi trên màn hình đăng nhập Google của sakubun</>
  );
}
