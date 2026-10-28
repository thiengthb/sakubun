import type { UserDb } from '@/lib/db/user-db';
import { loadStarterDeck, type StarterItem } from '@/lib/import/starter-deck';
import { addItems, VOCAB_KIND } from '@/lib/library/practice';

// Vietnamese meanings for the words of a Kaiwa script (phase 8, K5): the learner's own items first,
// then OpenJLPT's Vietnamese meanings from data/openjlpt. No outside service. Once the shared library
// lands (phase 8, L1) it takes OpenJLPT's place.

export interface WordMeaning {
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  level: string;
  // The learner's own item, when the word is in their library; otherwise the meaning is OpenJLPT's
  // and the page offers "Thêm vào kho".
  itemId: string | null;
}

// OpenJLPT's Vietnamese repeats itself at times ("cửa hàng; cửa hàng; tiệm"): each sense once.
export function distinctSenses(meaning: string): string {
  const seen = new Set<string>();
  return meaning
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join('; ');
}

let openJlpt: Promise<Map<string, StarterItem>> | null = null;

// OpenJLPT vocabulary by expression, built once per process; the first entry wins on a homograph.
function openJlptVocab(): Promise<Map<string, StarterItem>> {
  openJlpt ??= loadStarterDeck().then((deck) => {
    const byExpression = new Map<string, StarterItem>();
    for (const item of deck) {
      if (item.kind === VOCAB_KIND && !byExpression.has(item.expression)) {
        byExpression.set(item.expression, item);
      }
    }
    return byExpression;
  });
  return openJlpt;
}

export async function lookupWords(
  db: UserDb,
  keys: readonly string[],
): Promise<Record<string, WordMeaning>> {
  if (keys.length === 0) return {};
  const [mine, vocab] = await Promise.all([
    db.item.findMany({
      where: { expression: { in: [...keys] } },
      select: {
        id: true,
        expression: true,
        reading: true,
        hanviet: true,
        meaningVi: true,
        level: true,
      },
      // A word over a grammar pattern written the same way.
      orderBy: { kind: 'desc' },
    }),
    openJlptVocab(),
  ]);
  const found: Record<string, WordMeaning> = {};
  for (const key of keys) {
    const own = mine.find((i) => i.expression === key);
    if (own) {
      const { id, ...rest } = own;
      found[key] = { ...rest, itemId: id };
      continue;
    }
    const entry = vocab.get(key);
    if (entry) {
      found[key] = {
        expression: entry.expression,
        reading: entry.reading,
        hanviet: entry.hanviet ?? null,
        meaningVi: distinctSenses(entry.meaningVi),
        level: entry.level,
        itemId: null,
      };
    }
  }
  return found;
}

// "Thêm vào kho" on a looked-up word: the OpenJLPT entry, with its example, as a new item with its
// own review schedule, the same way every other add path makes one.
export async function addOpenJlptWord(
  db: UserDb,
  expression: string,
): Promise<{ itemId: string } | { reason: string }> {
  const entry = (await openJlptVocab()).get(expression);
  if (!entry) return { reason: 'Không có từ này trong OpenJLPT.' };
  const result = await addItems(
    db,
    [
      {
        expression: entry.expression,
        meaningVi: distinctSenses(entry.meaningVi),
        reading: entry.reading ?? undefined,
        hanviet: entry.hanviet ?? undefined,
        level: entry.level,
        notes: entry.notes ?? undefined,
      },
    ],
    'OPENJLPT',
    VOCAB_KIND,
  );
  const skipped = result.skipped[0]?.reason;
  if (result.created === 0)
    return { reason: skipped ? `Không thêm được: ${skipped}.` : 'Không thêm được từ này.' };
  const item = await db.item.findFirst({
    where: { kind: VOCAB_KIND, expression: entry.expression },
    select: { id: true },
  });
  return item ? { itemId: item.id } : { reason: 'Không thêm được từ này.' };
}
