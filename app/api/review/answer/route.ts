import { closingGradesSchema } from '@/lib/app/card-answer-schema';
import { answerCard } from '@/lib/app/quick-review';
import { routeUserId } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// U2f: the grades a study session still held as its page closed, sent by navigator.sendBeacon. No
// one reads the reply. Each grade carries the id the page gave it, so one that also got through the
// normal way (answerCardAction) is recorded once. Same rules as the action: answerCard decides.
export async function POST(req: Request) {
  const userId = await routeUserId('learner');
  if (userId instanceof Response) return userId;
  // A beacon is same-origin JSON; anything else is not this page.
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') {
    return Response.json({ ok: false, error: 'Chỉ nhận từ trang Ôn nhanh.' }, { status: 403 });
  }
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ ok: false, error: 'Gửi JSON.' }, { status: 415 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await req.text());
  } catch {
    return Response.json({ ok: false, error: 'Không phải JSON hợp lệ.' }, { status: 400 });
  }
  const parsed = closingGradesSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Danh sách lần chấm không hợp lệ.' }, { status: 400 });
  }

  const db = userDb(userId);
  let saved = 0;
  // In order, one at a time: the page gave them in the order they were made.
  for (const grade of parsed.data) {
    const result = await answerCard(db, grade);
    if (result.ok) saved++;
  }
  return Response.json({ ok: true, saved });
}
