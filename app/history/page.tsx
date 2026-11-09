import { redirect } from 'next/navigation';

// Lịch sử became the Tiến độ page (UI v2, phase 1). Old links, bookmarks and the links Claude sent
// in chat keep working: the query (?tab=nhap-vai, ?open=<id>) goes along.
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, v);
    }
  }
  redirect(query.size ? `/progress?${query}` : '/progress');
}
