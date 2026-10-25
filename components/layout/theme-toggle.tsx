'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === 'dark';
  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1 group-data-[collapsible=icon]:hidden">
        <span className="text-sm font-bold">Giao diện tối</span>
        <Switch
          checked={isDark}
          onCheckedChange={toggle}
          brandKnob
          aria-label="Bật/tắt giao diện tối"
        />
      </div>
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
