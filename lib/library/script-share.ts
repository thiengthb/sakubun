import type { SharePlan } from '@/lib/library/publish';

// Sharing a Kaiwa script on Kho chung (K7), the pure part: the same plan as an item's share
// (publish.ts), with a script's title and text as what travels. Pure: no Prisma, no I/O.

export interface ScriptContent {
  title: string;
  body: string;
}

// A shared script entry: its title is in `name`, its text in `body`.
export interface ScriptEntryContent {
  id: string;
  name: string | null;
  body: string | null;
}

export const sameScript = (script: ScriptContent, entry: ScriptEntryContent) =>
  script.title === (entry.name ?? '') && script.body === (entry.body ?? '');

// What sharing a script does, from the script, the entry it was taken from (if any), the learner's
// open share of it (if any), and whether the admin hid a share of it.
export function planScriptShare(
  script: ScriptContent,
  source: ScriptEntryContent | null,
  own: ScriptEntryContent | null,
  removed = false,
): SharePlan {
  if (removed) return { kind: 'removed' };
  if (own)
    return sameScript(script, own)
      ? { kind: 'unchanged', entryId: own.id }
      : { kind: 'update', entryId: own.id };
  if (source && sameScript(script, source)) return { kind: 'same-as-source', entryId: source.id };
  return { kind: 'create', basedOnId: source?.id ?? null };
}
