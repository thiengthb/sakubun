// THE canonical list of exercise types — one array, read by the MCP boundary AND by the web.
//
// Why it is its own leaf module (2026-08-12). The list used to live only inside the `z.enum([...])` in
// `lib/mcp/tool-kit.ts`, so the web could not reach it: importing that module into a client component
// drags zod, the render layer and Prisma along with it. The web therefore kept its own copy —
// `EXERCISE_TYPE_LABELS: Record<string, string>` in components/history/history-cards.tsx — typed as
// `string` and thus NOT checked for completeness against the enum.
//
// It happened to be complete when measured. The failure it was one commit away from is silent and not
// small: the /history TYPE FILTER is generated from `Object.entries(EXERCISE_TYPE_LABELS)`, so a type
// missing from that table cannot be filtered for at all — a whole class of the learner's own practice
// becomes unreachable in their history, with no error anywhere. The badge would vanish too
// (`typeLabel && …`), which is the visible half of the same omission.
//
// This is the preventive version of the lesson from lib/turn-labels.ts: a mapping with two copies is a
// mapping where one copy will be forgotten. Here the second copy is deleted instead of synchronised —
// with the list in a module both sides can import, `Record<ExerciseType, string>` makes the compiler do
// what a reminder was doing.
//
// NO imports on purpose: any dependency here would be a dependency of every client component that
// wants the type list, which is the situation that created the second copy.

export const EXERCISE_TYPES = [
  'TRANSLATION',
  'CLOZE',
  'DIALOGUE',
  'QUIZ',
  // CONVERSATION (2026-07-23): situational PRODUCTION practice — sourceText holds the scenario brief
  // (context + register + required items), userAnswer is the learner's own Japanese utterance. Graded +
  // FSRS-rated via the same stage_sentence/submit_review path.
  'CONVERSATION',
  // The two SCAFFOLDED production rungs (2026-07-26). Producing Japanese is a cliff, not a step: the
  // involvement-load ladder runs JA→VI (read) < quiz (recognise) < CLOZE_PRODUCTION < GUIDED_PRODUCTION
  // < VI→JA free < CONVERSATION, and until then the app only offered the two ends. Both reuse the
  // existing get_due_items → stage_sentence → submit_review pipeline with no schema change — the same
  // trick CONVERSATION used.
  'CLOZE_PRODUCTION',
  'GUIDED_PRODUCTION',
  // TEACH_BACK (2026-07-27): the learner EXPLAINS a pattern in Vietnamese and the explanation is
  // graded — the protégé effect / self-explanation. Same pipeline, no schema change.
  'TEACH_BACK',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];
