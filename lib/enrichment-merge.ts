import {
  CURRENT_ENRICHMENT_VERSION,
  ENRICHMENT_CAPS,
  enrichmentSchema,
  type Enrichment,
  type Related,
} from '@/lib/enrichment';
import { meetsCurrentBar } from '@/lib/enrichment-quality';
import { type ItemKind } from '@/lib/item-kinds';
import { normalizeExpression } from '@/lib/normalize';

type Example = Enrichment['example'];
type Contrast = Enrichment['contrasts'][number];

export interface EnrichmentAdd {
  structure?: string[];
  collocations?: string[];
  pitfalls?: string[];
  contrasts?: Contrast[];
  examples?: Example[];
  synonyms?: Related[];
  antonyms?: Related[];
}

export interface EnrichmentSet {
  usage?: string;
  register?: string;
  example?: Example;
  provenance?: Enrichment['provenance'];
}

export interface EnrichmentPatch {
  add?: EnrichmentAdd;
  set?: EnrichmentSet;
}

export type SkipReason = 'duplicate' | 'cap' | 'empty';

export interface MergeSkip {
  field: keyof EnrichmentAdd;
  value: string;
  reason: SkipReason;
}

export interface MergeReport {
  card: Enrichment;
  added: Partial<Record<keyof EnrichmentAdd, number>>;
  replaced: (keyof EnrichmentSet)[];
  skipped: MergeSkip[];
  vStamped: boolean;
  touched: boolean;
}

function appendUnique<T>(
  field: keyof EnrichmentAdd,
  existing: readonly T[],
  incoming: readonly T[] | undefined,
  identify: (entry: T) => string,
  cap: number,
  skipped: MergeSkip[],
): { list: T[]; added: number } {
  const list = [...existing];
  if (!incoming) return { list, added: 0 };

  const keys = new Set(list.map((e) => normalizeExpression(identify(e))));
  let added = 0;
  for (const entry of incoming) {
    const value = identify(entry).trim();
    const key = normalizeExpression(value);
    if (!key) {
      skipped.push({ field, value, reason: 'empty' });
      continue;
    }
    if (keys.has(key)) {
      skipped.push({ field, value, reason: 'duplicate' });
      continue;
    }
    if (list.length >= cap) {
      skipped.push({ field, value, reason: 'cap' });
      continue;
    }
    list.push(entry);
    keys.add(key);
    added += 1;
  }
  return { list, added };
}

export function mergeEnrichment(
  base: Enrichment,
  patch: EnrichmentPatch,
  kind: ItemKind,
): MergeReport {
  const skipped: MergeSkip[] = [];
  const added: Partial<Record<keyof EnrichmentAdd, number>> = {};
  const replaced: (keyof EnrichmentSet)[] = [];

  const asIs = (s: string): string => s;

  const structure = appendUnique(
    'structure',
    base.structure,
    patch.add?.structure,
    asIs,
    ENRICHMENT_CAPS.structure,
    skipped,
  );
  const collocations = appendUnique(
    'collocations',
    base.collocations,
    patch.add?.collocations,
    asIs,
    ENRICHMENT_CAPS.collocations,
    skipped,
  );
  const pitfalls = appendUnique(
    'pitfalls',
    base.pitfalls,
    patch.add?.pitfalls,
    asIs,
    ENRICHMENT_CAPS.pitfalls,
    skipped,
  );
  const contrasts = appendUnique(
    'contrasts',
    base.contrasts,
    patch.add?.contrasts,
    (c) => c.with,
    ENRICHMENT_CAPS.contrasts,
    skipped,
  );

  const demoted =
    patch.set?.example &&
    normalizeExpression(patch.set.example.ja) !== normalizeExpression(base.example.ja)
      ? [base.example]
      : [];
  const examples = appendUnique(
    'examples',
    base.examples,
    [...(patch.add?.examples ?? []), ...demoted],
    (e) => e.ja,
    ENRICHMENT_CAPS.examples,
    skipped,
  );

  const synonyms = appendUnique(
    'synonyms',
    base.synonyms,
    patch.add?.synonyms,
    (r) => r.term,
    ENRICHMENT_CAPS.synonyms,
    skipped,
  );
  const antonyms = appendUnique(
    'antonyms',
    base.antonyms,
    patch.add?.antonyms,
    (r) => r.term,
    ENRICHMENT_CAPS.antonyms,
    skipped,
  );

  if (structure.added) added.structure = structure.added;
  if (synonyms.added) added.synonyms = synonyms.added;
  if (antonyms.added) added.antonyms = antonyms.added;
  if (collocations.added) added.collocations = collocations.added;
  if (pitfalls.added) added.pitfalls = pitfalls.added;
  if (contrasts.added) added.contrasts = contrasts.added;
  if (examples.added) added.examples = examples.added;

  let usage = base.usage;
  if (patch.set?.usage !== undefined && patch.set.usage.trim() !== base.usage.trim()) {
    usage = patch.set.usage.trim();
    replaced.push('usage');
  }
  let register = base.register;
  if (
    patch.set?.register !== undefined &&
    patch.set.register.trim() !== (base.register ?? '').trim()
  ) {
    register = patch.set.register.trim() || undefined;
    replaced.push('register');
  }
  let example = base.example;
  if (
    patch.set?.example &&
    normalizeExpression(patch.set.example.ja) !== normalizeExpression(base.example.ja)
  ) {
    example = patch.set.example;
    replaced.push('example');
  }

  let provenance = base.provenance;
  if (
    patch.set?.provenance &&
    JSON.stringify(patch.set.provenance) !== JSON.stringify(base.provenance)
  ) {
    provenance = patch.set.provenance;
    replaced.push('provenance');
  }

  const merged: Enrichment = {
    ...base,
    ...(provenance ? { provenance } : {}),
    structure: structure.list,
    collocations: collocations.list,
    pitfalls: pitfalls.list,
    contrasts: contrasts.list,
    examples: examples.list,
    synonyms: synonyms.list,
    antonyms: antonyms.list,
    usage,
    example,
    ...(register === undefined ? {} : { register }),
  };
  if (register === undefined) delete merged.register;

  const vStamped = base.v < CURRENT_ENRICHMENT_VERSION && meetsCurrentBar(merged, kind);
  if (vStamped) merged.v = CURRENT_ENRICHMENT_VERSION;

  const parsed = enrichmentSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(
      `enrichment merge produced an invalid card (${parsed.error.issues[0]?.path.join('.')}: ` +
        `${parsed.error.issues[0]?.message}) — refusing to write it`,
    );
  }

  const touched = Object.keys(added).length > 0 || replaced.length > 0 || vStamped;

  return { card: parsed.data, added, replaced, skipped, vStamped, touched };
}

export function patchFromDonor(base: Enrichment, donor: Enrichment): EnrichmentPatch {
  return {
    add: {
      structure: donor.structure,
      collocations: donor.collocations,
      pitfalls: donor.pitfalls,
      contrasts: donor.contrasts,
      synonyms: donor.synonyms,
      antonyms: donor.antonyms,
      examples: [donor.example, ...donor.examples],
    },
    ...(base.register || !donor.register ? {} : { set: { register: donor.register } }),
  };
}
