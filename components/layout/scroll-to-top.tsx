'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Explain } from '@/components/common/explain';
import { Button } from '@/components/ui/button';

const SHOW_AFTER_PX = 300;

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
              className="size-10 rounded-full bg-card shadow-lg"
              onClick={() =>
                window.scrollTo({
                  top: 0,
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
