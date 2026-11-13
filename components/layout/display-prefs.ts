'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { setAppFuriganaAction } from '@/app/actions';

// The two display switches, shared by the sidebar's user menu and Cài đặt › Tài khoản (the phone
// has no user menu: its tab bar is the only navigation).

const emptySubscribe = () => () => {};

export function useDarkTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  return {
    dark: mounted && resolvedTheme === 'dark',
    set: (dark: boolean) => setTheme(dark ? 'dark' : 'light'),
  };
}

export function useFurigana(initial: boolean) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  // The page follows at once through the html element's data-furigana; the server copy and the
  // refresh follow.
  const show = (value: boolean) => {
    setOn(value);
    document.documentElement.dataset.furigana = value ? 'on' : 'off';
  };
  const set = (next: boolean) => {
    show(next);
    startTransition(async () => {
      const result = await setAppFuriganaAction(next);
      if (!result.ok) {
        show(!next);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };
  return { on, set, pending };
}
