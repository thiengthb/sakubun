import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Geist_Mono, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { LucideProvider } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/app-shell';
import { getSessionAccess } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';
import './globals.css';
import { cn } from '@/lib/core/utils';

const interSans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn(interSans.variable, geistMono.variable, 'h-full antialiased')}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionConfig reducedMotion="user">
            {/* Icons draw at 1.5, not lucide's 2: at 16px the default stroke read heavier than the
                600-weight text beside it (thien, item detail round 2, docs/ui-standard.md). */}
            <LucideProvider strokeWidth={1.5}>
              <TooltipProvider delayDuration={300}>
                <AppShell defaultSidebarOpen={sidebarOpen} furigana={furigana}>{children}</AppShell>
              </TooltipProvider>
            </LucideProvider>
          </MotionConfig>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
