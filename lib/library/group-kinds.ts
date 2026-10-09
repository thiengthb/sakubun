export const GROUP_KINDS = ['vocab', 'grammar', 'mixed'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export function isGroupKind(value: string): value is GroupKind {
  return (GROUP_KINDS as readonly string[]).includes(value);
}

// The learner-facing name of each kind. Data, not presentation — it lived in the badge component,
// which is why two files in features/resources had to import from features/groups just to spell
// "Từ vựng".
export const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  vocab: 'Từ vựng',
  grammar: 'Ngữ pháp',
  mixed: 'Hỗn hợp',
};
