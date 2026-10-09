import { prisma } from '@/lib/db/db';
import { normalizeExpression } from '@/lib/core/normalize';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/practice';

export const MAX_IMPORT_CANDIDATES = 40;

export type ImportKind = typeof GRAMMAR_KIND | typeof VOCAB_KIND;

export interface ImportCandidate {
  kind: ImportKind;
  expression: string;
  reading?: string;
  meaningVi: string;
  level?: string;
  notes?: string;
}

export interface DuplicateEntry extends ImportCandidate {
  itemId: string;
  stored: string;
  suspended: boolean;
}

export type AmbiguousReason = 'other-kind' | 'repeated';

export interface AmbiguousEntry extends ImportCandidate {
  reason: AmbiguousReason;
  itemId?: string;
  storedKind?: ImportKind;
}

export interface ImportPreview {
  new: ImportCandidate[];
  duplicate: DuplicateEntry[];
  ambiguous: AmbiguousEntry[];
  counts: { new: number; duplicate: number; ambiguous: number };
}

export async function previewImport(
  candidates: readonly ImportCandidate[],
): Promise<ImportPreview> {
  const mine = await prisma.item.findMany({
        select: { id: true, kind: true, expression: true, suspended: true },
  });

  const byKey = new Map<string, (typeof mine)[number]>();
  for (const row of mine) {
    byKey.set(`${row.kind}:${normalizeExpression(row.expression)}`, row);
  }

  const fresh: ImportCandidate[] = [];
  const duplicate: DuplicateEntry[] = [];
  const ambiguous: AmbiguousEntry[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = normalizeExpression(candidate.expression);
    const sameKind = byKey.get(`${candidate.kind}:${key}`);
    if (sameKind) {
      duplicate.push({
        ...candidate,
        itemId: sameKind.id,
        stored: sameKind.expression,
        suspended: sameKind.suspended,
      });
      continue;
    }

    if (seen.has(`${candidate.kind}:${key}`)) {
      ambiguous.push({ ...candidate, reason: 'repeated' });
      continue;
    }
    seen.add(`${candidate.kind}:${key}`);

    const otherKind = candidate.kind === GRAMMAR_KIND ? VOCAB_KIND : GRAMMAR_KIND;
    const crossKind = byKey.get(`${otherKind}:${key}`);
    if (crossKind) {
      ambiguous.push({
        ...candidate,
        reason: 'other-kind',
        itemId: crossKind.id,
        storedKind: otherKind as ImportKind,
      });
      continue;
    }

    fresh.push(candidate);
  }

  return {
    new: fresh,
    duplicate,
    ambiguous,
    counts: { new: fresh.length, duplicate: duplicate.length, ambiguous: ambiguous.length },
  };
}
