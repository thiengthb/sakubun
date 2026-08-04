import type { Metadata } from 'next';
import { ResourceAddPage } from '@/components/resources/resource-add-page';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Thêm vào kho — sakubun' };
export const dynamic = 'force-dynamic';

/**
 * "Thêm ngữ pháp / từ vựng" — a ROUTE, not a modal (2026-08-04). See ResourceAddForm for why.
 *
 * `?kind=vocab` selects the vocab copy; anything else (including a missing param) falls back to
 * grammar rather than 404-ing — the only two callers are the two buttons on /resources, so a bad value
 * means a hand-typed URL, and landing on the grammar form is a better answer than an error page.
 */
export default async function ResourceAddRoute({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const { kind } = await searchParams;

  return <ResourceAddPage kind={kind === 'vocab' ? 'vocab' : 'grammar'} />;
}
