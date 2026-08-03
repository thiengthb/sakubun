'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const emptySubscribe = () => () => {};

/**
 * Light/dark theme control. Expanded sidebar: a labelled toggle row with a Switch (not an action
 * button). Collapsed icon rail: a single icon button that flips the theme (a Switch has no room there).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch — the server render always treats the theme as not-yet-resolved.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === 'dark';
  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <>
      {/* Expanded: [icon + label ............ Switch] */}
      <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1 group-data-[collapsible=icon]:hidden">
        <span className="flex items-center gap-2 text-sm">
          {isDark ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
          Giao diện tối
        </span>
        <Switch checked={isDark} onCheckedChange={toggle} aria-label="Bật/tắt giao diện tối" />
      </div>
      {/* Collapsed rail: an icon button that toggles. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Bật/tắt giao diện tối"
        className="hidden size-7 group-data-[collapsible=icon]:flex"
      >
        {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      </Button>
    </>
  );
}
