'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import type { GroupSummary } from '@/lib/library/groups';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

// Editing a group is a page of its own (docs/ui-standard.md › Bốn khuôn trang): the button is a
// link to it, on every screen (the card's icon is in group-card.tsx).

/** The group page's secondary header action. */
export function GroupEditButton({ group }: { group: GroupSummary }) {
  return (
    <ExpandingIconButton asChild icon={Pencil} label="Sửa">
      <Link href={`/groups/${group.id}/edit`} />
    </ExpandingIconButton>
  );
}
