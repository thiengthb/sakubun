import { prisma } from '@/lib/db/db';
import { loadStarterDeck } from '@/lib/import/starter-deck';
import { OPENJLPT_ORIGIN, seedOpenJlpt } from '@/lib/library/shared';

// The shared library starts as OpenJLPT (phase 8, L2): seeded the first time a page reads it, once
// per process. seedOpenJlpt adds only what is missing, so a restart or a second process is safe.
let seeding: Promise<void> | null = null;

export function ensureOpenJlptLibrary(): Promise<void> {
  seeding ??= (async () => {
    if ((await prisma.libraryEntry.count({ where: { origin: OPENJLPT_ORIGIN } })) > 0) return;
    const added = await seedOpenJlpt(prisma, await loadStarterDeck());
    console.log(`[library] seeded OpenJLPT: ${added.entries} entries, ${added.groups} groups`);
  })().catch((error) => {
    seeding = null;
    throw error;
  });
  return seeding;
}
