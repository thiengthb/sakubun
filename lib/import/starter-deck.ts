// Roadmap 7.2: every new learner starts with their own copy of the OpenJLPT deck, built from the files
// in data/openjlpt with the builder the import file uses. It is never copied from another learner, so
// nobody's notes, stars or explanation cards travel. Ids are new for each learner: the build's fixed
// ids belong to whoever imported the file first.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { UserDb } from '@/lib/db/user-db';
import { buildImport, type BuildResult } from '@/lib/import/openjlpt';

export type StarterItem = BuildResult['items'][number];

const DATA_DIR = path.join(process.cwd(), 'data/openjlpt');

export async function loadStarterDeck(dir = DATA_DIR): Promise<StarterItem[]> {
  const read = async (file: string) => JSON.parse(await readFile(path.join(dir, file), 'utf8'));
  const [src, vi, hv, overrides] = await Promise.all([
    read('source.json'),
    read('vi.json'),
    read('hanviet-kanji.json'),
    read('hanviet-overrides.json'),
  ]);
  return buildImport(src, vi, hv, new Date(), overrides.words).items;
}

const key = (i: { kind: string; expression: string }) => `${i.kind}\u0000${i.expression}`;

// The deck items a learner does not have yet (same kind + expression), each under a fresh id.
export function missingStarterItems(
  deck: readonly StarterItem[],
  have: Iterable<{ kind: string; expression: string }>,
  newId: () => string = randomUUID,
): StarterItem[] {
  const owned = new Set([...have].map(key));
  return deck.filter((i) => !owned.has(key(i))).map((i) => ({ ...i, id: newId() }));
}

const CHUNK = 500;

// Gives the learner every deck item they lack, each with a new review schedule due now. Safe to run
// again: what they already have (or once had and kept) is skipped. Returns how many items were added.
export async function seedStarterDeck(
  db: UserDb,
  deck: readonly StarterItem[],
  now = new Date(),
): Promise<number> {
  const have = await db.item.findMany({ select: { kind: true, expression: true } });
  const rows = missingStarterItems(deck, have);
  if (rows.length === 0) return 0;
  const userId = db.$ownerId();
  await db.$transaction(
    async (tx) => {
      for (let at = 0; at < rows.length; at += CHUNK) {
        const chunk = rows.slice(at, at + CHUNK);
        await tx.item.createMany({ data: chunk.map((i) => ({ ...i, userId })) });
        await tx.srsState.createMany({
          data: chunk.map((i) => ({ id: randomUUID(), userId, itemId: i.id, due: now })),
        });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  return rows.length;
}
