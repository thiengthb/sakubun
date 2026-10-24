'use client';

import { useOptionalSidebar } from '@/components/ui/sidebar';
import { AppLogo } from '@/components/layout/app-logo';

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
          className="flex cursor-pointer items-center rounded-sm active:translate-y-0.5"
        >
          <AppLogo />
        </button>
      ) : (
        <AppLogo />
      )}
    </div>
  );
}
