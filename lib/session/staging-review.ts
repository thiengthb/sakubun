import { prisma } from '@/lib/db/db';
import { VOCAB_KIND } from '@/lib/library/item-kinds';
import {
  fixOkurigana,
  okuriganaCandidates,
  stripRuby,
  vocabAppears,
} from '@/lib/session/staging-checks';

interface StagingArgs {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string;
  sourceRuby?: string | null;
  suggestedRuby?: string | null;
  items?: { itemId: string; role: string }[];
}

// Repairs what can be repaired before the sentence is stored, and says what it did (see
// staging-checks.ts for why). VOCAB items absent from the Japanese side are dropped (not reviewed);
// furigana with okurigana inside the reading is fixed; ruby that does not match its text is dropped.
export async function reviewStaging<T extends StagingArgs>(
  args: T,
): Promise<{ args: T; notes: string[] }> {
  const notes: string[] = [];
  const japanese = args.direction === 'JA_VI' ? args.sourceText : args.suggested;

  const all = args.items ?? [];
  const vocabIds = all.filter((i) => i.role === 'VOCAB').map((i) => i.itemId);
  const vocab = vocabIds.length
    ? await prisma.item.findMany({
        where: { id: { in: vocabIds }, kind: VOCAB_KIND },
        select: { id: true, expression: true, reading: true },
      })
    : [];
  const absent = vocab.filter((v) => !vocabAppears(v.expression, v.reading, japanese));
  const absentIds = new Set(absent.map((v) => v.id));
  const items = all.filter((i) => !absentIds.has(i.itemId));
  if (absent.length) {
    notes.push(
      `VOCAB not in the sentence, so NOT staged and NOT to be rated: ${absent
        .map((v) => `「${v.expression}」`)
        .join(' ')}. Do not grade these words for this sentence.`,
    );
  }

  const rubyFields = (['sourceRuby', 'suggestedRuby'] as const).filter((k) => args[k]?.trim());
  const candidates = rubyFields.flatMap((k) => okuriganaCandidates(args[k] as string));
  const known = new Map(
    candidates.length
      ? (
          await prisma.item.findMany({
            where: { expression: { in: candidates }, reading: { not: null } },
            select: { expression: true, reading: true },
          })
        ).map((r) => [r.expression, r.reading as string] as const)
      : [],
  );
  const out = { ...args, items } as T;
  for (const k of rubyFields) {
    const plain = k === 'sourceRuby' ? args.sourceText : args.suggested;
    const { ruby, fixed } = fixOkurigana(args[k] as string, known);
    if (fixed.length)
      notes.push(`Furigana fixed in ${k} (okurigana was inside the reading): ${fixed.join(', ')}.`);
    if (stripRuby(ruby).replace(/\s/g, '') !== plain.replace(/\s/g, '')) {
      out[k] = null as T[typeof k];
      notes.push(`${k} dropped: without the [readings] it does not match the text it annotates.`);
    } else {
      out[k] = ruby as T[typeof k];
    }
  }
  return { args: out, notes };
}
