import { AppLogo } from '@/components/layout/app-logo';

// The phone's page header starts with the logo alone. It used to open the sidebar as a sheet; the
// tab bar at the foot is now the phone's one way around (thien, U1 gate), so there is nothing to
// open.
export function MobileTopBar() {
  return (
    <div className="flex items-center gap-2 md:hidden">
      <AppLogo />
    </div>
  );
}
