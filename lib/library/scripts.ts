import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import type { Tokenize } from '@/lib/kaiwa/furigana';
import { digestScript } from '@/lib/kaiwa/layout';
import { checkScript, describeProblems } from '@/lib/kaiwa/parse';
import { saveScript } from '@/lib/kaiwa/scripts';
import { japaneseTokenizer } from '@/lib/kaiwa/tokenizer';
import type { PublishResult } from '@/lib/library/publish';
import { planScriptShare } from '@/lib/library/script-share';
import {
  HIDDEN,
  LEARNER_ORIGIN,
  MAX_RESULTS,
  PUBLIC,
  REMOVED,
  SCRIPT_TYPE,
  VISIBLE,
  type LibraryClient,
} from '@/lib/library/shared';

// Kaiwa scripts on Kho chung (K7; plan docs/plans/2026-10-31-k7-kaiwa-library.md). A learner shares
// one of their scripts as a snapshot entry, at most one open share per script, which sharing again
// updates. Anyone takes a copy into their own Hội thoại. Only the web calls this. Likes and the
// admin's hiding are the same as for items (likes.ts, moderation.ts).

export const SCRIPT_REMOVED_BY_ADMIN =
  'Quản trị đã ẩn kịch bản này khỏi Kho chung, nên không chia sẻ lại được.';
export const SCRIPT_SAME_AS_SOURCE =
  'Kịch bản này giống hệt bản bạn lấy từ Kho chung. Sửa nó rồi mới chia sẻ được.';
const NO_SCRIPT = 'Không tìm thấy kịch bản này. Có thể nó đã bị xoá.';
const GONE = 'Kịch bản này không còn trên Kho chung.';

const SCRIPT_FIELDS = { id: true, title: true, body: true, libraryEntryId: true } as const;
const ENTRY_CONTENT = { id: true, name: true, body: true, status: true, takeCount: true } as const;

type ScriptRow = { id: string; title: string; body: string; libraryEntryId: string | null };

// The learner's open share of the script, the entry it was taken from, and whether the admin hid a
// share of it.
async function shareContext(db: UserDb, script: ScriptRow) {
  const [shares, source] = await Promise.all([
    db.libraryEntry.findMany({
      where: {
        authorId: db.$ownerId(),
        sourceId: script.id,
        type: SCRIPT_TYPE,
        status: { in: [PUBLIC, REMOVED] },
      },
      select: ENTRY_CONTENT,
    }),
    script.libraryEntryId
      ? db.libraryEntry.findFirst({
          where: { id: script.libraryEntryId, type: SCRIPT_TYPE },
          select: ENTRY_CONTENT,
        })
      : null,
  ]);
  const own = shares.find((e) => e.status === PUBLIC) ?? null;
  const removed = shares.some((e) => e.status === REMOVED);
  return {
    own,
    source,
    removed,
    plan: planScriptShare(script, source, own, removed),
  };
}

const findScript = (db: UserDb, scriptId: string) =>
  db.script.findFirst({ where: { id: scriptId }, select: SCRIPT_FIELDS });

export interface ScriptShareStatus {
  // The learner's open share, if any, and whether the script has changed since.
  shared: { entryId: string; takeCount: number; changed: boolean } | null;
  // Taken from Kho chung: the entry it came from, when it still exists.
  basedOn: { entryId: string; status: string } | null;
  // Why "Chia sẻ" is refused now, if it is.
  blocked: string | null;
}

export async function scriptShareStatus(
  db: UserDb,
  scriptId: string,
): Promise<ScriptShareStatus | null> {
  const script = await findScript(db, scriptId);
  if (!script) return null;
  const { own, source, plan } = await shareContext(db, script);
  return {
    shared: own
      ? { entryId: own.id, takeCount: own.takeCount, changed: plan.kind === 'update' }
      : null,
    basedOn: source ? { entryId: source.id, status: source.status } : null,
    blocked:
      plan.kind === 'same-as-source'
        ? SCRIPT_SAME_AS_SOURCE
        : plan.kind === 'removed'
          ? SCRIPT_REMOVED_BY_ADMIN
          : null,
  };
}

// Shares the script, or updates its open share with the script as it is now. A copy taken from Kho
// chung and left as it was is refused: sharing it would only make a duplicate.
export async function publishScript(
  db: UserDb,
  scriptId: string,
): Promise<ActionResult<PublishResult>> {
  const script = await findScript(db, scriptId);
  if (!script) return err(NO_SCRIPT);
  const problems = checkScript(script.title, script.body);
  if (problems.length > 0) return err(describeProblems(problems));
  const { plan } = await shareContext(db, script);
  if (plan.kind === 'same-as-source') return err(SCRIPT_SAME_AS_SOURCE);
  if (plan.kind === 'removed') return err(SCRIPT_REMOVED_BY_ADMIN);
  const content = { name: script.title, body: script.body };
  if (plan.kind === 'update')
    await db.libraryEntry.update({ where: { id: plan.entryId }, data: content });
  if (plan.kind !== 'create') return ok({ entryId: plan.entryId, created: false });
  const created = await db.libraryEntry.create({
    data: {
      ...content,
      type: SCRIPT_TYPE,
      origin: LEARNER_ORIGIN,
      authorId: db.$ownerId(),
      sourceId: script.id,
      basedOnId: plan.basedOnId,
    },
    select: { id: true },
  });
  return ok({ entryId: created.id, created: true });
}

// The share leaves Kho chung; whoever took it keeps their copy.
export async function unpublishScript(
  db: UserDb,
  scriptId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await db.libraryEntry.updateMany({
    where: { authorId: db.$ownerId(), sourceId: scriptId, type: SCRIPT_TYPE, status: PUBLIC },
    data: { status: HIDDEN },
  });
  return res.count > 0 ? ok({ hidden: res.count }) : err('Kịch bản này chưa được chia sẻ.');
}

// The learner's copies of these shared scripts, by entry id: what they took, and for their own
// shares the script they shared it from.
export async function scriptCopies(
  db: UserDb,
  entries: readonly { id: string; authorId: string | null; sourceId: string | null }[],
): Promise<Map<string, string>> {
  if (entries.length === 0) return new Map();
  const mine = entries.filter((e) => e.authorId === db.$ownerId() && e.sourceId);
  const scripts = await db.script.findMany({
    where: {
      OR: [
        { libraryEntryId: { in: entries.map((e) => e.id) } },
        { id: { in: mine.map((e) => e.sourceId!) } },
      ],
    },
    select: { id: true, libraryEntryId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const copies = new Map<string, string>();
  for (const e of mine) if (scripts.some((s) => s.id === e.sourceId)) copies.set(e.id, e.sourceId!);
  for (const s of scripts)
    if (s.libraryEntryId && !copies.has(s.libraryEntryId)) copies.set(s.libraryEntryId, s.id);
  return copies;
}

export interface TakeScriptResult {
  scriptId: string;
  // The learner had a copy already (or it is their own share): nothing was copied.
  already: boolean;
}

// Copies a shared script into the learner's Hội thoại as a script of their own, version 1, with its
// furigana worked out again. Taking it again opens the copy they have.
export async function takeScript(
  db: UserDb,
  entryId: string,
  tokenizer: () => Promise<Tokenize> = japaneseTokenizer,
): Promise<ActionResult<TakeScriptResult>> {
  const entry = await db.libraryEntry.findFirst({
    where: { id: entryId, type: SCRIPT_TYPE, ...VISIBLE },
    select: { id: true, name: true, body: true, authorId: true, sourceId: true },
  });
  if (!entry?.body) return err(GONE);
  const had = (await scriptCopies(db, [entry])).get(entry.id);
  if (had) return ok({ scriptId: had, already: true });
  const saved = await saveScript(
    db,
    { title: entry.name ?? 'Kịch bản từ Kho chung', body: entry.body, libraryEntryId: entry.id },
    tokenizer,
  );
  if (!saved.ok) return saved;
  await db.libraryEntry.updateMany({
    where: { id: entry.id },
    data: { takeCount: { increment: 1 } },
  });
  return ok({ scriptId: saved.data.id, already: false });
}

const LISTED = {
  id: true,
  name: true,
  body: true,
  authorId: true,
  sourceId: true,
  basedOnId: true,
  author: { select: { name: true } },
  takeCount: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { likes: true } },
} as const;

type ListedRow = {
  id: string;
  name: string | null;
  body: string | null;
  author: { name: string } | null;
  _count: { likes: number };
};
const listed = <T extends ListedRow>({ author, _count, name, body, ...rest }: T) => ({
  ...rest,
  title: name ?? '',
  body: body ?? '',
  author: author?.name ?? null,
  likes: _count.likes,
  ...digestScript(body ?? ''),
});

// Shared scripts, public only, matching a search on the title or the text: the most taken first,
// then the most liked, then the newest.
export async function listScriptEntries(
  db: LibraryClient,
  { text, take }: { text?: string; take?: number } = {},
) {
  const needle = text?.trim();
  const rows = await db.libraryEntry.findMany({
    where: {
      type: SCRIPT_TYPE,
      ...VISIBLE,
      ...(needle ? { OR: [{ name: { contains: needle } }, { body: { contains: needle } }] } : {}),
    },
    select: LISTED,
    orderBy: [
      { takeCount: 'desc' },
      { likes: { _count: 'desc' } },
      { createdAt: 'desc' },
      { id: 'asc' },
    ],
    take: Math.min(take ?? MAX_RESULTS, MAX_RESULTS),
  });
  return rows.map(listed);
}

// One public script for its own page; null when it is not shared (any more).
export async function getScriptEntry(db: LibraryClient, id: string) {
  const row = await db.libraryEntry.findFirst({
    where: { id, type: SCRIPT_TYPE, ...VISIBLE },
    select: LISTED,
  });
  return row ? listed(row) : null;
}
