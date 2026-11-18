import type { LevelSet, LevelSets, StateCounts } from '@/lib/library/level-sets';
import { libraryLevelHref, type BoardLevel } from '@/lib/library/level-tally';

// What the level screen offers (U4c2, docs/plans/2026-11-14-u4-kho.md): the three actions of
// "Bước tiếp theo" and each set's button. Pure. New items reach the learner only through Ôn nhanh,
// which takes them from the level set in Cài đặt, a few a day (lib/app/queue.ts); so "Học" on
// another level sends the learner to that setting rather than promising what Ôn nhanh won't do.

export type LevelKind = 'grammar' | 'vocab';

export interface LevelContext {
  level: BoardLevel;
  kind: LevelKind;
  // The level Ôn nhanh takes this kind's new items from (Cài đặt › Luyện tập).
  studyLevel: string;
}

export interface LevelAction {
  label: string;
  hint: string;
  count: number | null;
  // null: nothing to do here, shown without a link.
  href: string | null;
}

export interface LeadActions {
  main: LevelAction;
  due: LevelAction;
  take: LevelAction;
}

export const KIND_LABEL: Record<LevelKind, string> = { grammar: 'Ngữ pháp', vocab: 'Từ vựng' };
const UNIT: Record<LevelKind, string> = { grammar: 'mẫu', vocab: 'từ' };

export const REVIEW_HREF = '/review';
export const STUDY_LEVEL_HREF = '/settings?tab=practice';

export function leadActions(sets: LevelSets, ctx: LevelContext): LeadActions {
  const unit = UNIT[ctx.kind];
  const take = libraryLevelHref(ctx.level, ctx.kind);
  const { counts } = sets;
  return {
    main: mainAction(sets, ctx, unit, take),
    due: {
      label: 'Ôn đến hạn',
      hint: counts.due > 0 ? 'trong Ôn nhanh' : 'chưa có mục nào đến hạn',
      count: counts.due,
      href: counts.due > 0 ? REVIEW_HREF : null,
    },
    take: {
      label: 'Lấy nốt',
      hint: counts.none > 0 ? `${unit} chưa có trong kho` : 'đã có đủ cả cấp',
      count: counts.none,
      href: counts.none > 0 ? take : null,
    },
  };
}

function mainAction(
  { counts, next }: LevelSets,
  ctx: LevelContext,
  unit: string,
  take: string,
): LevelAction {
  if (next?.kind === 'study' && ctx.studyLevel === ctx.level) {
    return {
      label: 'Học tiếp',
      hint: `Chặng ${next.set} còn ${next.count} ${unit} chưa học · Ôn nhanh đưa ra theo số mới mỗi ngày`,
      count: counts.new,
      href: REVIEW_HREF,
    };
  }
  if (next?.kind === 'study') {
    return {
      label: 'Học cấp này',
      hint: `Ôn nhanh đang lấy ${unit} mới từ ${ctx.studyLevel}; đổi cấp đang học trong Cài đặt`,
      count: counts.new,
      href: STUDY_LEVEL_HREF,
    };
  }
  if (next?.kind === 'take') {
    return {
      label: `Lấy chặng ${next.set}`,
      hint: `${next.count} ${unit} chưa có trong kho`,
      count: next.count,
      href: take,
    };
  }
  return {
    label: 'Đủ cả cấp',
    hint: `Bạn đã lấy và học mọi ${unit} của cấp này`,
    count: null,
    href: null,
  };
}

/** A set's button: review what is due, else take what is missing; "Thuộc hết" when all is learnt. */
export function setAction(
  set: LevelSet,
  ctx: Pick<LevelContext, 'level' | 'kind'>,
): LevelAction | null {
  const { counts } = set;
  if (counts.due > 0)
    return { label: `Ôn ${counts.due}`, hint: 'trong Ôn nhanh', count: null, href: REVIEW_HREF };
  if (counts.none > 0)
    return {
      label: `Lấy ${counts.none}`,
      hint: `${UNIT[ctx.kind]} chưa có trong kho`,
      count: null,
      href: libraryLevelHref(ctx.level, ctx.kind),
    };
  if (counts.mastered === set.words.length)
    return { label: 'Thuộc hết', hint: '', count: null, href: null };
  return null;
}

const SUMMARY: [keyof StateCounts, string][] = [
  ['mastered', 'thuộc'],
  ['due', 'đến hạn'],
  ['learning', 'đang học'],
  ['new', 'chưa học'],
  ['none', 'chưa có'],
  ['paused', 'tạm ngưng'],
];

/** "18 thuộc · 1 đến hạn · 1 đang học", leaving out the states the set has none of. */
export function setSummary(counts: StateCounts): string {
  return SUMMARY.filter(([state]) => counts[state] > 0)
    .map(([state, label]) => `${counts[state]} ${label}`)
    .join(' · ');
}
