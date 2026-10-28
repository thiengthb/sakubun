'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Explain } from '@/components/common/explain';
import { Toggle } from '@/components/ui/toggle';
import { setAppFuriganaAction } from '@/app/actions';

const emptySubscribe = () => () => {};

// The sidebar's display switches (thien, 7.4): furigana and dark mode, two icon toggles of one kind
// side by side, stacked when the sidebar is folded. Furigana is a setting of the learner, saved on
// the server so every page and device follows it; the pages read it on the server, so a refresh
// redraws them.
export function DisplayToggles({ furigana }: { furigana: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
      <span className="mr-auto text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
        Hiển thị
      </span>
      {furigana !== null && <FuriganaToggle initial={furigana} />}
      <ThemeToggle />
    </div>
  );
}

function FuriganaToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  const label = on ? 'Ẩn furigana' : 'Hiện furigana';

  const toggle = (next: boolean) => {
    setOn(next);
    startTransition(async () => {
      const result = await setAppFuriganaAction(next);
      if (!result.ok) {
        setOn(!next);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Explain text={label}>
      <Toggle
        variant="choice"
        pressed={on}
        onPressedChange={toggle}
        disabled={pending}
        aria-label={label}
        lang="ja"
        className="w-7.5 md:w-7.5"
      >
        あ
      </Toggle>
    </Explain>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === 'dark';
  const label = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';

  return (
    <Explain text={label}>
      <Toggle
        variant="choice"
        pressed={isDark}
        onPressedChange={(dark) => setTheme(dark ? 'dark' : 'light')}
        aria-label={label}
        className="w-7.5 md:w-7.5"
      >
        {isDark ? <Moon aria-hidden /> : <Sun aria-hidden />}
      </Toggle>
    </Explain>
  );
}
