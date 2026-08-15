export const GROUP_KINDS = ['vocab', 'grammar', 'mixed'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export function isGroupKind(value: string): value is GroupKind {
  return (GROUP_KINDS as readonly string[]).includes(value);
}
