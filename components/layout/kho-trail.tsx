'use client';

import { Library } from 'lucide-react';
import { Breadcrumbs, type Crumb } from '@/components/layout/breadcrumbs';
import { khoTrail, type KhoPlace, type TrailStep } from '@/lib/library/kho-trail';

/**
 * A Kho screen's trail (KN1, docs/plans/2026-11-19-kho-navigation.md): the screens above `place`,
 * then `extra` (a record the screen acts on, like the group whose items it adds). On a phone it is
 * one way back to the nearest of them.
 */
export function KhoTrail({ place, extra = [] }: { place: KhoPlace; extra?: TrailStep[] }) {
  const items: Crumb[] = [...khoTrail(place), ...extra].map((step) => ({
    label: step.label,
    href: step.href,
    pending: step.pending,
    icon: step.root ? Library : undefined,
    description: step.root ? 'Kho của bạn' : `Về ${step.label}`,
  }));
  return <Breadcrumbs items={items} parentsOnly back />;
}
