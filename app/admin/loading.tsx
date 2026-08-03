import { ListSkeleton, PageSkeleton } from '@/components/shell/page-skeleton';

// Admin — no tabs, no toolbar; a single divide-y member list (avatar + name/email + last-active).
export default function Loading() {
  return (
    <PageSkeleton>
      <ListSkeleton rows={5} />
    </PageSkeleton>
  );
}
