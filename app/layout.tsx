import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/app-shell';
import { RootDocument } from '@/components/layout/root-document';
import { getSessionAccess } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sakubun.thientnse.site'),
  title: 'sakubun',
  description: 'Luyện dịch Nhật–Việt bằng spaced repetition, học qua MCP',
  appleWebApp: { capable: true, title: 'sakubun', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#262624' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  // The sidebar's あ shows the learner's furigana setting (7.4a); nobody signed in, no switch.
  const session = await getSessionAccess();
  const furigana =
    session && session.access !== 'none'
      ? furiganaInApp((await getSettings(userDb(session.userId))).furiganaMode)
      : null;

  return (
    <RootDocument>
      <AppShell defaultSidebarOpen={sidebarOpen} furigana={furigana}>
        {children}
      </AppShell>
    </RootDocument>
  );
}
