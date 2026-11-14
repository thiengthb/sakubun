import type { ComponentProps } from 'react';
import { cn } from '@/lib/core/utils';

// The one lead area of a page (Hôm nay's cards to study, UI v2 U3): a tinted block the eye goes to
// first. It owns the wash so pages never write the chosen-wash classes themselves.

const TONE = {
  brand: 'bg-brand-wash',
  ok: 'bg-ok-wash',
} as const;

export function LeadPanel({
  tone = 'brand',
  className,
  ...props
}: ComponentProps<'section'> & { tone?: keyof typeof TONE }) {
  return <section className={cn('rounded-xl p-5 md:p-6', TONE[tone], className)} {...props} />;
}
