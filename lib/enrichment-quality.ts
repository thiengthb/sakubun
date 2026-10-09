import {
  CURRENT_ENRICHMENT_VERSION,
  enrichmentSchema,
  parseEnrichment,
  type Enrichment,
  type Provenance,
} from '@/lib/enrichment';
import { VOCAB_KIND, asItemKind, type ItemKind } from '@/lib/item-kinds';

export const QUALITY_TIERS = ['missing', 'broken', 'thin', 'outdated', 'ok', 'rich'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

interface Dimension {
  key: string;
  label: string;
  present: (card: Enrichment) => boolean;
}

const MIN_USAGE_CHARS = 25;

const MIN_EXAMPLES = 2;

const MIN_VOCAB_COLLOCATIONS = 2;

function allExamples(c: Enrichment): Enrichment['examples'] {
  return [c.example, ...c.examples];
}

function relationCount(c: Enrichment): number {
  return c.synonyms.length + c.antonyms.length;
}

const usageDimension: Dimension = {
  key: 'usage',
  label: 'cách dùng',
  present: (c) => c.usage.trim().length >= MIN_USAGE_CHARS,
};
const pitfallsDimension: Dimension = {
  key: 'pitfalls',
  label: 'bẫy hay gặp',
  present: (c) => c.pitfalls.length >= 1,
};

const GRAMMAR_DIMENSIONS: readonly Dimension[] = [
  {
    key: 'structure',
    label: 'cách chia / cách gắn',
    present: (c) => c.structure.length >= 1,
  },
  usageDimension,
  {
    key: 'examples',
    label: 'ví dụ',
    present: (c) => allExamples(c).length >= MIN_EXAMPLES,
  },
  pitfallsDimension,
  { key: 'contrasts', label: 'phân biệt mẫu gần nghĩa', present: (c) => c.contrasts.length >= 1 },
];

const VOCAB_DIMENSIONS: readonly Dimension[] = [
  usageDimension,
  {
    key: 'examples',
    label: 'ví dụ có dịch tiếng Việt',
    present: (c) => {
      const examples = allExamples(c);
      return examples.length >= MIN_EXAMPLES && examples.every((e) => e.vi.trim().length > 0);
    },
  },
  {
    key: 'collocations',
    label: 'cụm / khung câu hay đi kèm',
    present: (c) => c.collocations.length >= MIN_VOCAB_COLLOCATIONS,
  },
  {
    key: 'relations',
    label: 'từ đồng nghĩa / trái nghĩa',
    present: (c) => relationCount(c) >= 1,
  },
  pitfallsDimension,
];

export function dimensionsFor(kind: ItemKind): readonly Dimension[] {
  return kind === VOCAB_KIND ? VOCAB_DIMENSIONS : GRAMMAR_DIMENSIONS;
}

export function meetsCurrentBar(card: Enrichment, kind: ItemKind): boolean {
  return dimensionsFor(kind).every((d) => d.present(card));
}

function richnessBonus(card: Enrichment, kind: ItemKind): number {
  let bonus = 0;
  if (card.register) bonus += 1;
  if (card.examples.some((e) => e.jaRuby)) bonus += 1; // furigana-ready examples
  if (card.pitfalls.length >= 2) bonus += 1;

  if (kind === VOCAB_KIND) {
    if (card.synonyms.length >= 2) bonus += 1;
    if (card.antonyms.length >= 1) bonus += 1;
    if (card.collocations.length >= 4) bonus += 1;
    if (card.structure.length >= 1) bonus += 1;
    return bonus;
  }

  if (card.collocations.length >= 2) bonus += 1;
  if (card.contrasts.length >= 2) bonus += 1;
  return bonus;
}

export interface QualityReport {
  tier: QualityTier;
  score: number;
  missing: string[];
  v: number;
  broken: boolean;
  provenance?: Provenance;
}

export function scoreEnrichment(raw: string | null | undefined, kind: string): QualityReport {
  const dimensions = dimensionsFor(asItemKind(kind));

  if (!raw || !raw.trim()) {
    return {
      tier: 'missing',
      score: 0,
      missing: dimensions.map((d) => d.label),
      v: 0,
      broken: false,
    };
  }

  const card = parseEnrichment(raw);
  if (!card) {
    let v = 1;
    try {
      const loose = JSON.parse(raw) as { v?: unknown };
      if (typeof loose.v === 'number') v = loose.v;
    } catch {
    }
    return {
      tier: 'broken',
      score: 0,
      missing: dimensions.map((d) => d.label),
      v,
      broken: true,
    };
  }

  const missingDims = dimensions.filter((d) => !d.present(card));
  const met = dimensions.length - missingDims.length;
  const bonus = richnessBonus(card, asItemKind(kind));
  const score = Math.round((met / dimensions.length) * 80 + Math.min(bonus, 5) * 4);

  const tier: QualityTier =
    missingDims.length > 0
      ? 'thin'
      : card.v < CURRENT_ENRICHMENT_VERSION
        ? 'outdated'
        : bonus >= 3
          ? 'rich'
          : 'ok';

  return {
    tier,
    score,
    missing: missingDims.map((d) => d.label),
    v: card.v,
    broken: false,
    ...(card.provenance ? { provenance: card.provenance } : {}),
  };
}

export const NEEDS_WORK: readonly QualityTier[] = ['missing', 'broken', 'thin', 'outdated'];

export function needsWork(tier: QualityTier): boolean {
  return NEEDS_WORK.includes(tier);
}

export const TIER_LABELS: Record<QualityTier, string> = {
  missing: 'chưa có thẻ',
  broken: 'thẻ lỗi (không đọc được)',
  thin: 'thẻ còn thiếu',
  outdated: 'thẻ theo format cũ',
  ok: 'thẻ đủ',
  rich: 'thẻ chi tiết',
};

export { CURRENT_ENRICHMENT_VERSION, enrichmentSchema };
