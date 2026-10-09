'use client';

import { Separator } from '@/components/ui/separator';
import { useOptionalSidebar } from '@/components/ui/sidebar';
import { AppLogo } from '@/components/shell/app-logo';

export function MobileTopBar() {
  const sidebar = useOptionalSidebar();

  return (
    <div className="flex items-center gap-2 md:hidden">
      {sidebar ? (
        <button
          type="button"
          onClick={sidebar.toggleSidebar}
          aria-label="Mở menu"
          aria-expanded={sidebar.openMobile}
          className="-m-1.5 flex cursor-pointer items-center rounded-md p-1.5 transition-colors hover:bg-muted active:bg-muted"
        >
          <AppLogo />
        </button>
      ) : (
        <AppLogo />
      )}
      <Separator orientation="vertical" className="h-5" />
    </div>
  );
}
