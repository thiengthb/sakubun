'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GroupSummary } from '@/lib/library/groups';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

// Editing a group is a page of its own (docs/ui-standard.md › Bốn khuôn trang): both buttons are
// links to it, on every screen.

/** A group card's edit icon. */
export function GroupEditAction({ group }: { group: GroupSummary }) {
  return (
    <Button asChild variant="ghost" size="icon" aria-label={`Sửa nhóm ${group.name}`}>
      <Link href={`/groups/${group.id}/edit`}>
        <Pencil aria-hidden />
      </Link>
    </Button>
  );
}

/** The group page's secondary header action. */
export function GroupEditButton({ group }: { group: GroupSummary }) {
  return (
    <ExpandingIconButton asChild icon={Pencil} label="Sửa">
      <Link href={`/groups/${group.id}/edit`} />
    </ExpandingIconButton>
  );
}
