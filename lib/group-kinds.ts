// Client-safe group-kind constants + type. Kept OUT of lib/groups.ts (which imports the Prisma
// singleton, server-only) so client components can import the enum/type without dragging the DB layer
// — and node:module — into the browser bundle. lib/groups.ts re-exports these for server convenience.

export const GROUP_KINDS = ['vocab', 'grammar', 'mixed'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export function isGroupKind(value: string): value is GroupKind {
  return (GROUP_KINDS as readonly string[]).includes(value);
}
