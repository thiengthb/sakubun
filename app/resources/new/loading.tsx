import { FormCardSkeleton, PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';

// /resources/new — the add page: `width="form"` (max-w-2xl), 3 input tabs on the header row
// (Theo trường / Dán danh sách / Nhập Excel). Rail 317px at 1440, select 137px at 390 (measured).
// NEW 2026-08-05 — it used to fall back to the dashboard skeleton, at full page width.
export default function Loading() {
  return (
    <PageSkeleton width="form" section="grammar" action="add" aside={<TabsAside count={3} rail={317} select={137} />}>
      <FormCardSkeleton fields={5} />
    </PageSkeleton>
  );
}
