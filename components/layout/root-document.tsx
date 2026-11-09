import { Geist_Mono, Onest } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { LucideProvider } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/core/utils';

// Onest, the one UI font of thienui (token font.sans; thien chose it for sakubun as UI v2 D3).
// next/font's list has no `vietnamese` subset for Onest, but Google serves one: next/font keeps every
// @font-face block Google returns and only preloads the subsets named here, so ạ, ố, ữ (U+1EA0-1EF9)
// still load from Onest. e2e/fonts.spec.ts checks they do not fall back to a system font.
const onestSans = Onest({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
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
export function RootDocument({
  children,
  furigana = null,
}: {
  children: React.ReactNode;
  /** The learner's furigana setting; null when nobody is signed in (readings then show). */
  furigana?: boolean | null;
}) {
  return (
    <html
      lang="vi"
      // One switch for the whole app (thien, 2026-11-07): globals.css hides every reading under
      // data-furigana="off" and shows them all otherwise, with no hover in between.
      data-furigana={furigana === false ? 'off' : 'on'}
      suppressHydrationWarning
      className={cn(onestSans.variable, geistMono.variable, 'h-full antialiased')}
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
              <TooltipProvider delay={300}>{children}</TooltipProvider>
            </LucideProvider>
          </MotionConfig>
          {/* Above the phone's tab bar while it shows (--float-bottom, globals.css). */}
          <Toaster
            position="bottom-center"
            offset={{ bottom: 'max(24px, var(--float-bottom))' }}
            mobileOffset={{ bottom: 'var(--float-bottom)' }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
