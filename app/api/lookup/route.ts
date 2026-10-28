import { z } from 'zod';
import { routeUserId } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { lookupSentences } from '@/lib/japanese/sentence-lookup';
import { LOOKUP_BATCH } from '@/lib/japanese/sentence-words';

// The hover lookup on every Japanese sentence (7.4b): one call per page for the sentences it shows.
// A route, not a server action: actions run one at a time per page, and the first lookup (the
// dictionary loading) must never hold up a learner's answer.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const body = z.object({
  texts: z.array(z.string().min(1).max(500)).min(1).max(LOOKUP_BATCH),
});

export async function POST(req: Request) {
  const userId = await routeUserId('learner');
  if (userId instanceof Response) return userId;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: `Gửi { texts: [...] }, tối đa ${LOOKUP_BATCH} câu, mỗi câu tới 500 ký tự.` },
      { status: 400 },
    );
  }
  return Response.json(await lookupSentences(userDb(userId), parsed.data.texts), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
