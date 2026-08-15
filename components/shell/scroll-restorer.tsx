'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Restore the window scroll position per route within the browser-tab session, so returning to a page
 * via the sidebar's bare links lands where you left off — the App Router resets scroll to the top on a
 * client navigation, which loses your place on long pages (a detail page, settings, the dashboard).
 * The viewport-fit list pages (resources/library/history) don't page-scroll by design, so
 * this is a no-op there. Renders nothing; mounted once by `PageShell` so every in-shell route gets it.
 *
 * Restore is deferred until the streamed/Suspense content is tall enough to reach the saved offset
 * (RSC paints after mount), retried across a few frames then given up — so it never jumps to a stale,
 * too-short layout. Scroll is saved throttled. Keyed by pathname, so each route (and each detail id)
 * remembers its own position.
 */
export function ScrollRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    const key = `sakubun:scroll:${pathname}`;
    let raf = 0;
    let tries = 0;
    let saveTimer = 0;

    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(key) ?? '0') || 0;
    } catch {
      saved = 0;
    }

    const restore = () => {
      if (saved <= 0) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // Wait until the page is tall enough (content painted); bail after ~30 frames so a genuinely
      // short page never spins.
      if (max >= saved || tries > 30) {
        window.scrollTo(0, Math.min(saved, Math.max(0, max)));
        return;
      }
      tries += 1;
      raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);

    const onScroll = () => {
      if (saveTimer) return;
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        try {
          sessionStorage.setItem(key, String(Math.round(window.scrollY)));
        } catch {
          // best-effort; a full/blocked sessionStorage just means no restore next time
        }
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [pathname]);

  return null;
}
