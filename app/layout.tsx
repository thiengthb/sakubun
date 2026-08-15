import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Geist_Mono, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/layout/app-shell';
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
  description: 'Luyện dịch Nhật–Việt bằng spaced repetition, học qua Claude Desktop (MCP)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';

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
            <TooltipProvider delayDuration={300}>
              <AppShell defaultSidebarOpen={sidebarOpen}>{children}</AppShell>
            </TooltipProvider>
          </MotionConfig>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
