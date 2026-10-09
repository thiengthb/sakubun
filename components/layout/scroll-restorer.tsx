'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

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
