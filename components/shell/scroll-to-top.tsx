'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Explain } from '@/components/shared/explain';
import { Button } from '@/components/ui/button';

/**
 * How far down the page the button appears. 300px, not a full viewport: several pages here are only
 * ~1.4 viewports tall on a laptop (the dashboard measures ~1265px at 1280×900, /guide ~978px), so a
 * 400px threshold meant the button never appeared on desktop at all — it can only show if the page can
 * actually scroll that far.
 */
const SHOW_AFTER_PX = 300;

/**
 * "Back to top" — appears at the bottom-right once the page is scrolled past ~400px, and returns to the
 * top when tapped. The app's long pages (the dashboard is ~2000px on a phone, /guide longer) had no way
 * back up except swiping, which on a tall list is a dozen flicks.
 *
 * Placement notes, because the bottom edge is crowded:
 *   - bottom-right, clear of the Toaster (bottom-CENTRE, sonner) and of the bulk-action dock
 *     (right edge, vertically centred — this sits below it and both are visible at once).
 *   - `bottom-[max(1rem,env(safe-area-inset-bottom))]` keeps it above the iOS home indicator.
 *   - `md:hidden` is deliberately NOT set: a laptop page can be just as long, and Home/Ctrl+Home is
 *     not discoverable.
 *
 * Scroll listening is passive and throttled to one state flip per crossing (the setState is a no-op
 * while the boolean does not change, so React bails out and there is no re-render per scroll event).
 * The reveal is transform+opacity only, so the global prefers-reduced-motion rule neutralises it.
 */
export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER_PX);
    onScroll(); // a restored scroll position (ScrollRestorer) can land mid-page before any scroll event
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40"
        >
          <Explain side="left" text="Lên đầu trang">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Lên đầu trang"
              // bg-card (not the default transparent outline fill) so it stays legible over whatever
              // it happens to float above — a table, a chart, a wall of text.
              className="size-10 rounded-full bg-card shadow-lg"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  // `instant` when the user asked for less motion — a 2000px smooth scroll is exactly
                  // the kind of movement that setting exists to stop.
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                })
              }
            >
              <ArrowUp className="size-5" aria-hidden />
            </Button>
          </Explain>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
