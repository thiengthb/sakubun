import { Geist_Mono, Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { LucideProvider } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/core/utils';

const interSans = Inter({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/**
 * <html> and <body> with the fonts, theme and providers every page draws with. Both the root layout
 * and app/global-error.tsx render it: global-error replaces the root layout, so before this it
 * had its own <html> that lost the fonts (text fell back to Times) and the dark theme.
 */
export function RootDocument({ children }: { children: React.ReactNode }) {
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
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </LucideProvider>
          </MotionConfig>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
