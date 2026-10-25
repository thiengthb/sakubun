'use client';

import { type CSSProperties } from 'react';
import { DUO_FLAME } from '@/lib/srs/streak-tiers';
import { cn } from '@/lib/core/utils';

// Duolingo's flame, flat: an orange body with a lick on its left and a yellow core. Grey while
// there is no streak. thien, Phân tích round 1.
const BODY =
  'M12.6 1.2c.4 3.1 2.4 5.1 4.2 7.2 1.7 2 2.9 4 2.9 6.6 0 4.4-3.4 7.6-7.7 7.6S4.3 19.4 4.3 15.2c0-2.6 1.2-4.6 2.8-6.1.2 1.4.9 2.6 2.1 3.2-.5-4.7 1.2-8.6 3.4-11.1Z';
const CORE =
  'M12.3 11.4c1.1 1.6 3.3 2.9 3.3 5.6 0 2.3-1.6 3.9-3.6 3.9s-3.6-1.5-3.6-3.6c0-1.3.6-2.3 1.4-3 .1.7.5 1.3 1.1 1.5-.2-1.7.4-3.3 1.4-4.4Z';

export function StreakFlame({
  count,
  className,
  hero = false,
  sizePx,
}: {
  count: number;
  className?: string;
  /** The celebration's big flame: rises in, then sways. */
  hero?: boolean;
  sizePx?: number;
}) {
  const cold = count < 1;
  const colors = cold ? DUO_FLAME.cold : DUO_FLAME.lit;
  const style = (sizePx ? { width: sizePx, height: sizePx } : undefined) as
    CSSProperties | undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={style}
      className={cn(
        'size-4 streak-duo',
        // A lit flame keeps swaying gently, as Duolingo's does. thien, Phân tích round 2.
        !cold && (hero ? 'streak-duo--hero' : 'streak-duo--sway'),
        className,
      )}
    >
      <path fill={colors.body} d={BODY} />
      <path className={cold ? undefined : 'streak-duo-core'} fill={colors.core} d={CORE} />
    </svg>
  );
}
