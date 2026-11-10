import { AppLogo } from '@/components/layout/app-logo';

// The phone's page header starts with the logo alone. It used to open the sidebar as a sheet; the
// tab bar at the foot is now the phone's one way around (thien, U1 gate), so there is nothing to
// open.
export function MobileTopBar() {
  return (
    <div className="flex items-center gap-2 md:hidden">
      {/* The slot the menu button used to fill: the logo and its 2px lip, 36px tall. */}
      <span data-app-logo="" className="flex">
        <AppLogo />
      </span>
    </div>
  );
}
