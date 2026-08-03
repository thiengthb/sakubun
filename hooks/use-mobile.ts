import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * `true` when the viewport is below the mobile breakpoint. Uses `useSyncExternalStore` instead of a
 * setState-in-effect (repo lint rule `react-hooks/set-state-in-effect`); the server snapshot assumes
 * desktop so SSR markup is stable until hydration.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
