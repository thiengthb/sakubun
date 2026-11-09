'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ChevronsUpDown, LogOut, Moon, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth/auth-client';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { UserAvatar } from '@/components/layout/user-avatar';
import { setAppFuriganaAction } from '@/app/actions';

const emptySubscribe = () => () => {};

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Khung điều hướng): the user block at the foot of
// the sidebar opens one menu: Cài đặt, the dark theme, furigana, Đăng xuất. The あ and theme
// toggles that sat loose above it moved in here. Furigana is a setting of the learner, saved on the
// server so every page and device follows it; the pages read it on the server, so a refresh
// redraws them.
export function SidebarUser({
  user,
  furigana,
}: {
  user: { name: string; email: string; image?: string | null };
  /** The learner's furigana setting; null leaves the switch out (an account with no access). */
  furigana: boolean | null;
}) {
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const folded = state === 'collapsed' && !isMobile;
  const [leaving, setLeaving] = useState(false);
  const theme = useDarkTheme();
  const reading = useFurigana(furigana ?? false);

  async function logout() {
    setLeaving(true);
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tài khoản: ${user.name}`}
        className="flex w-full items-center gap-2 rounded-lg border-2 border-control-edge bg-card p-2 text-left shadow-lift outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-none data-popup-open:translate-y-0.5 data-popup-open:shadow-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none"
      >
        <UserAvatar name={user.name} image={user.image} size="md" />
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <span className="block truncate text-sm leading-tight font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className="text-muted-foreground group-data-[collapsible=icon]:hidden"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={folded ? 'right' : 'top'}
        align={folded ? 'end' : 'start'}
        // The block sits 8px from the window's edge, inside the usual 16px gutter: with the gutter
        // the menu was pushed 8px right of the block it opens from (thien, U1 gate).
        collisionPadding={8}
        className="min-w-56"
      >
        {/* On a phone the menu sits in the sidebar sheet, which closes with it, as the nav links do. */}
        <DropdownMenuLinkItem
          render={<Link href="/settings" />}
          onClick={isMobile ? () => setOpenMobile(false) : undefined}
        >
          <Settings aria-hidden />
          Cài đặt
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem checked={theme.dark} onCheckedChange={theme.set}>
            <Moon aria-hidden />
            Giao diện tối
          </DropdownMenuCheckboxItem>
          {furigana !== null && (
            <DropdownMenuCheckboxItem
              checked={reading.on}
              onCheckedChange={reading.set}
              disabled={reading.pending}
            >
              <span aria-hidden lang="ja" className="flex size-4 items-center justify-center">
                あ
              </span>
              Hiện furigana
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} disabled={leaving}>
          <LogOut aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useDarkTheme() {
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

function useFurigana(initial: boolean) {
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
