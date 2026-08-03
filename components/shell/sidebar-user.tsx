'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shell/user-avatar';

/**
 * Sidebar footer identity card: avatar + name + email, with a normal "Đăng xuất" button below.
 * Expanded shows the full card; collapsed to the icon rail it shrinks to just the avatar (log out by
 * expanding). The avatar (shared `UserAvatar`) uses the account image when present, else initials.
 */
export function SidebarUser({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-sidebar-accent/40 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
      <UserAvatar name={user.name} image={user.image} size="md" />
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <div className="truncate text-sm font-medium leading-tight">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      {/* Logout on the SAME row as the avatar + name (per request): a compact icon button at the end. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={logout}
        disabled={pending}
        aria-label="Đăng xuất"
        title="Đăng xuất"
        className="size-8 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
