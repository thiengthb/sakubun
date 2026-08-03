'use client';

import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { motion, type Variants } from 'motion/react';

/**
 * Shared Motion vocabulary — the platform animation standard in component form.
 *
 * Reduced-motion is handled globally by `<MotionConfig reducedMotion="user">` in the root layout,
 * so nothing here re-implements that guard. Every animation only touches `transform`/`opacity`
 * (GPU-friendly, no layout thrash). Compose these instead of hand-writing `<motion.div>` variants
 * per screen, so motion reads as one system.
 */

/** Enter transition tuned once; reused everywhere so timing feels consistent. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Fade + rise on mount. The default building block for hero copy, cards, section headers. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

/** Container that reveals its `<StaggerItem>` children one after another. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

type DivProps = ComponentPropsWithoutRef<typeof motion.div>;

/**
 * Fade/rise a block into view the first time it scrolls near the viewport (once). Use for
 * below-the-fold sections so the page reveals as the visitor scrolls.
 */
export function Reveal({
  children,
  amount = 0.3,
  ...props
}: { children: ReactNode; amount?: number } & DivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={fadeUp}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * A group whose direct `<StaggerItem>` children animate in sequence when the group enters view.
 * Drop `<StaggerItem>`s inside for the cascade (feature grids, step lists).
 */
export function StaggerGroup({
  children,
  amount = 0.2,
  ...props
}: { children: ReactNode; amount?: number } & DivProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={staggerContainer}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** One item in a `<StaggerGroup>`. Inherits the group's stagger timing via the shared variants. */
export function StaggerItem({ children, ...props }: { children: ReactNode } & DivProps) {
  return (
    <motion.div variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}
