// NON-DESTRUCTIVE enrichment merge. PURE (no DB) so the one property that matters — existing content
// is never lost — is a unit test rather than a hope.
//
// WHY this exists at all. `enrich_items` writes the WHOLE card, and a runtime lab proved (2026-07-26)
// what that costs: adding ONE contrast to a full card wiped 1 structure entry, 1 collocation, 1 pitfall
// and the pre-existing contrast, and the tool answered `{"updated":1,"missing":[]}` — a success. Any
// feature that appends to a card (the ratchet, "take the missing parts from a shared copy", a teach-back
// explanation becoming the usage line) therefore needed a merge path BEFORE it could ship at all; see
// docs/plans/2026-07-26-agentic-tutor-loop.md step 2.1 and the HARD DEPENDENCY on it in 2.3.
//
// Two shapes, deliberately unequal:
//   `add` — the five LIST fields. Append + dedup + respect the schema cap. Existing entries always win.
//   `set` — the three SCALAR fields. Replace, because a one-line usage note has no "append" meaning.
// There is no way to remove or rewrite a list entry here: that is a whole-card decision and belongs to
// `enrich_items`, which is honest about overwriting.

import {
  CURRENT_ENRICHMENT_VERSION,
  ENRICHMENT_CAPS,
  enrichmentSchema,
  type Enrichment,
} from '@/lib/enrichment';
import { meetsCurrentBar } from '@/lib/enrichment-quality';
import { normalizeExpression } from '@/lib/normalize';

type Example = Enrichment['example'];
type Contrast = Enrichment['contrasts'][number];

/** The list fields — appendable. */
export interface EnrichmentAdd {
  structure?: string[];
  collocations?: string[];
  pitfalls?: string[];
  contrasts?: Contrast[];
  examples?: Example[];
}

/** The scalar fields — replaceable. */
export interface EnrichmentSet {
  usage?: string;
  register?: string;
  /** Replacing the canonical example DEMOTES the old one into `examples` rather than dropping it. */
  example?: Example;
  /** Who is now standing behind the card. A patch changes authorship, so it may restate it. */
  provenance?: Enrichment['provenance'];
}

export interface EnrichmentPatch {
  add?: EnrichmentAdd;
  set?: EnrichmentSet;
}

/** Why an incoming entry did not land. Reported, never silent — a silent drop is the bug being fixed. */
export type SkipReason = 'duplicate' | 'cap' | 'empty';

export interface MergeSkip {
  field: keyof EnrichmentAdd;
  /** The entry's identifying text (the string itself, a contrast's `with`, an example's `ja`). */
  value: string;
  reason: SkipReason;
}

export interface MergeReport {
  card: Enrichment;
  /** How many entries actually landed, per field. Absent field = nothing offered for it. */
  added: Partial<Record<keyof EnrichmentAdd, number>>;
  /** Scalar fields whose value actually changed (an identical `set` is not a change). */
  replaced: (keyof EnrichmentSet)[];
  skipped: MergeSkip[];
  /** True when the merge brought the card up to the current format and re-stamped `v`. */
  vStamped: boolean;
  /** False when the patch was a complete no-op — the caller can then skip the write entirely. */
  touched: boolean;
}

/**
 * Append `incoming` onto `existing`, skipping duplicates and anything past the cap.
 *
 * Existing entries are copied first and never re-examined, which is what makes "content is never lost"
 * structural rather than careful: the cap can only ever drop something NEW.
 */
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

/**
 * Merge a patch into an existing card.
 *
 * Throws if the result would not satisfy `enrichmentSchema`. That is a fail-loud safety net, not an
 * expected path: writing a card the app can no longer parse would turn a `thin` item into a `broken`
 * one, which is strictly worse than refusing the patch.
 */
export function mergeEnrichment(base: Enrichment, patch: EnrichmentPatch): MergeReport {
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
  // A contrast is identified by WHAT it contrasts with: re-sending 〜ばかりに vs 〜せいで with a
  // differently-worded note is the same contrast, and the stored note is the one a human already saw.
  const contrasts = appendUnique(
    'contrasts',
    base.contrasts,
    patch.add?.contrasts,
    (c) => c.with,
    ENRICHMENT_CAPS.contrasts,
    skipped,
  );

  // Replacing the canonical example: the old one is DEMOTED into the extras (subject to dedup + cap),
  // so `set.example` cannot silently destroy the example the card already had.
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

  if (structure.added) added.structure = structure.added;
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
    usage,
    example,
    ...(register === undefined ? {} : { register }),
  };
  if (register === undefined) delete merged.register;

  // `v` means "complete under the CURRENT format", so it is stamped only when the merged card actually
  // meets the bar. Stamping on every touch would let a one-collocation patch claim the new format for a
  // card still missing three dimensions — and `v` is what `ENRICH_OUTDATED` reasons about.
  const vStamped = base.v < CURRENT_ENRICHMENT_VERSION && meetsCurrentBar(merged);
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

/**
 * Build the patch that takes the parts MY card lacks from a better public copy.
 *
 * Asymmetric on purpose: their list entries are appended (more examples/pitfalls/contrasts is strictly
 * more reference material) but `usage` and the canonical `example` are NEVER taken — those are mine,
 * and "your card is thinner" is not a licence to overwrite the learner's own content. `register` is
 * only filled when mine has none.
 */
export function patchFromDonor(base: Enrichment, donor: Enrichment): EnrichmentPatch {
  return {
    add: {
      structure: donor.structure,
      collocations: donor.collocations,
      pitfalls: donor.pitfalls,
      contrasts: donor.contrasts,
      // Their canonical example is just another worked example from my side.
      examples: [donor.example, ...donor.examples],
    },
    ...(base.register || !donor.register ? {} : { set: { register: donor.register } }),
  };
}
