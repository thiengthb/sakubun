import { z } from 'zod';

export const exampleSchema = z.object({
  ja: z.string().min(1),
  vi: z.string().min(1),
  jaRuby: z.string().optional(),
});

export const ENRICHMENT_CAPS = {
  structure: 6,
  collocations: 8,
  examples: 4,
  pitfalls: 5,
  contrasts: 5,
  synonyms: 6,
  antonyms: 4,
} as const;

export const relatedSchema = z.object({
  term: z.string().min(1),
  reading: z.string().optional(),
  vi: z.string().min(1),
  note: z.string().optional(),
});

export type Related = z.infer<typeof relatedSchema>;

export const provenanceSchema = z.object({
  by: z.string().min(1).max(60).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  basedOn: z.string().min(1).max(120).optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

export const contrastSchema = z.object({ with: z.string().min(1), note: z.string().min(1) });

export const enrichmentSchema = z.object({
  structure: z.array(z.string().min(1)).max(ENRICHMENT_CAPS.structure).default([]),
  usage: z.string().min(1),
  collocations: z.array(z.string()).max(ENRICHMENT_CAPS.collocations).default([]),
  example: exampleSchema,
  examples: z.array(exampleSchema).max(ENRICHMENT_CAPS.examples).default([]),
  pitfalls: z.array(z.string()).max(ENRICHMENT_CAPS.pitfalls).default([]),
  contrasts: z.array(contrastSchema).max(ENRICHMENT_CAPS.contrasts).default([]),
  synonyms: z.array(relatedSchema).max(ENRICHMENT_CAPS.synonyms).default([]),
  antonyms: z.array(relatedSchema).max(ENRICHMENT_CAPS.antonyms).default([]),
  register: z.string().optional(),
  v: z.number().int().min(1).default(1),
  provenance: provenanceSchema.optional().catch(undefined),
});

export const CURRENT_ENRICHMENT_VERSION = 3;

export type Enrichment = z.infer<typeof enrichmentSchema>;

export interface TutorCard {
  structure: string[];
  usage: string;
  collocations: string[];
  pitfalls: string[];
  contrasts: { with: string; note: string }[];
  register?: string;
  examples?: { ja: string; vi: string }[];
  synonyms?: { term: string; vi: string }[];
  antonyms?: { term: string; vi: string }[];
}

const INTRO_EXAMPLES = 2;

const INTRO_RELATIONS = 2;

export function toTutorCard(raw: string | null | undefined, isNew: boolean): TutorCard | null {
  const card = parseEnrichment(raw);
  if (!card) return null;

  const trimmed: TutorCard = {
    structure: card.structure,
    usage: card.usage,
    collocations: card.collocations,
    pitfalls: card.pitfalls,
    contrasts: card.contrasts,
  };
  if (card.register) trimmed.register = card.register;

  if (isNew) {
    trimmed.examples = [card.example, ...card.examples]
      .slice(0, INTRO_EXAMPLES)
      .map(({ ja, vi }) => ({ ja, vi }));
    const relation = (list: Related[]) =>
      list.slice(0, INTRO_RELATIONS).map(({ term, vi }) => ({ term, vi }));
    if (card.synonyms.length > 0) trimmed.synonyms = relation(card.synonyms);
    if (card.antonyms.length > 0) trimmed.antonyms = relation(card.antonyms);
  }
  return trimmed;
}

export function parseEnrichment(raw: string | null | undefined): Enrichment | null {
  if (!raw) return null;
  try {
    const result = enrichmentSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
