import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading fallback for the PUBLIC landing page at "/" (signed-out visitors). Mirrors
 * `landing-page.tsx`'s frame — full-bleed, no sidebar, a sticky top bar + the hero's two-column grid
 * (copy on the left, the signature practice card on the right) — so a guest reloading "/" never flashes
 * the signed-in DASHBOARD skeleton (`app/loading.tsx`'s other branch), which carried stat cards + a
 * breadcrumb row that belong to the app shell, not the marketing page.
 *
 * Server component (plain Skeleton pulses, no motion): the real landing owns the entrance animation.
 */
const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-6';

export function LandingSkeleton() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      {/* top bar — brand on the left, auth actions on the right (matches the landing header) */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className={`${CONTAINER} flex h-15 items-center justify-between py-2.5`}>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </header>

      {/* hero — same two-column grid as the real page */}
      <section className="py-16 sm:py-20">
        <div className={CONTAINER}>
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="space-y-5">
              <Skeleton className="h-7 w-72 max-w-full rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-4/5" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-full max-w-xl" />
                <Skeleton className="h-5 w-3/4 max-w-xl" />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Skeleton className="h-11 w-44 rounded-md" />
                <Skeleton className="h-11 w-44 rounded-md" />
              </div>
            </div>
            {/* signature practice card placeholder */}
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
