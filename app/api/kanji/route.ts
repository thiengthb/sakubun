import { routeUserId } from '@/lib/auth/current-user';
import { compareKanji } from '@/lib/kanji/catalog';
import { kanjiCatalog } from '@/lib/kanji/load';

// The Jōyō catalog for Tài nguyên › Kanji (KJ2). A route the tab fetches when it opens, so the
// other tabs of Tài nguyên do not carry 2,136 kanji. The same for every learner and fixed until the
// next deploy, so the browser keeps it for an hour.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const userId = await routeUserId('learner');
  if (userId instanceof Response) return userId;
  const catalog = [...(await kanjiCatalog())].sort(compareKanji);
  return Response.json(catalog, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
