import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Geist_Mono, Inter, Newsreader } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/shell/app-shell';
import { getOptionalSessionUser } from '@/lib/current-user';
import './globals.css';

// Inter supports the Vietnamese subset (Geist on Google Fonts does not).
const interSans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// The heading serif (globals.css --font-display / --font-heading). Newsreader is a variable font with a
// real optical-size axis, so one file covers a 12px card title and a 30px hero without either looking
// like the other size stretched — and it carries the Vietnamese subset, which most display serifs do not.
const displaySerif = Newsreader({
  variable: '--font-serif-display',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  // Italic is loaded because the serif is what quotes/emphasis land in; without it the browser
  // synthesises a slanted roman, which is exactly the detail that makes a page look unfinished.
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  // Absolute base for social-card URLs (the OG image at app/opengraph-image.tsx). Without it Next warns
  // and falls back to localhost, which makes a shared link's preview image unreachable.
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
  // Restore the sidebar's collapsed/expanded state server-side so it doesn't flash on reload.
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  // Server-resolved auth so the shell can render the public landing at "/" chromeless (no sidebar)
  // for guests without a client-side flash.
  const authed = (await getOptionalSessionUser()) !== null;

  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${interSans.variable} ${displaySerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Platform animation standard: Motion honours the OS "reduce motion" setting globally,
              so individual components never re-implement that guard. */}
          <MotionConfig reducedMotion="user">
            <TooltipProvider delayDuration={300}>
              <AppShell defaultSidebarOpen={sidebarOpen} authed={authed}>
                {children}
              </AppShell>
            </TooltipProvider>
          </MotionConfig>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
