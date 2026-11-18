import type { LevelSet, LevelSets, StateCounts } from '@/lib/library/level-sets';
import { libraryLevelHref, type BoardLevel } from '@/lib/library/level-tally';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// What the level screen offers (U4c2, docs/plans/2026-11-14-u4-kho.md): the three actions of
// "Bước tiếp theo" and each set's button. Pure. New items reach the learner only through Ôn nhanh,
// which takes them from the level set in Cài đặt and the levels below it, a few a day
// (lib/app/queue.ts); so "Học" on a harder level sends the learner to that setting rather than
// promising what Ôn nhanh won't do.

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

// Ôn nhanh takes new items from the study level and, now and then, from the levels below it, in its
// own mixed order (lib/domain/new-items.ts): so "Học" counts the whole level, never one set.
function servedByReview(level: string, studyLevel: string): boolean {
  const at = (l: string) => JLPT_LEVELS.indexOf(l as (typeof JLPT_LEVELS)[number]);
  return at(level) >= 0 && at(studyLevel) >= 0 && at(level) <= at(studyLevel);
}

function mainAction(
  { sets, counts, mastered, next }: LevelSets,
  ctx: LevelContext,
  unit: string,
  take: string,
): LevelAction {
  if (next?.kind === 'study' && servedByReview(ctx.level, ctx.studyLevel)) {
    return {
      label: 'Học tiếp',
      hint:
        ctx.level === ctx.studyLevel
          ? `${unit} chưa học, Ôn nhanh đưa ra dần mỗi ngày`
          : `${unit} chưa học, Ôn nhanh xen dần vào khi bạn học ${ctx.studyLevel}`,
      count: counts.new,
      href: REVIEW_HREF,
    };
  }
  if (next?.kind === 'study') {
    return {
      label: 'Học cấp này',
      hint: `Ôn nhanh đang lấy ${unit} mới từ ${ctx.studyLevel}, đổi trong Cài đặt`,
      count: counts.new,
      href: STUDY_LEVEL_HREF,
    };
  }
  if (next?.kind === 'take') {
    // Kho chung lists the whole level; it cannot open on one set.
    return {
      label: 'Lấy thêm',
      hint: `${unit} chưa có trong kho, từ Chặng ${next.set}`,
      count: counts.none,
      href: take,
    };
  }
  const total = sets.reduce((n, s) => n + s.words.length, 0);
  if (total === 0)
    return {
      label: 'Chưa có mục',
      hint: 'Kho chung chưa có mục nào ở cấp này',
      count: null,
      href: null,
    };
  if (mastered === total)
    return {
      label: 'Thuộc cả cấp',
      hint: `Bạn đã thuộc mọi ${unit} của cấp này`,
      count: null,
      href: null,
    };
  // Paused words leave Ôn nhanh (lib/app/queue.ts), so they are counted apart from those in review.
  const paused = counts.paused;
  const reviewing = total - mastered - paused;
  if (reviewing === 0)
    return {
      label: 'Đang tạm ngưng',
      hint: `${paused} ${unit} tạm ngưng, bỏ tạm ngưng để học tiếp`,
      count: null,
      href: null,
    };
  return {
    label: 'Đang ôn',
    hint:
      `Còn ${reviewing} ${unit} đang ôn, Ôn nhanh nhắc khi đến hạn` +
      (paused > 0 ? ` · ${paused} tạm ngưng` : ''),
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

/** What each mark of a set means, read by screen readers and on hover. */
export const STATE_LABEL: Record<keyof StateCounts, string> = {
  mastered: 'đã thuộc',
  due: 'đến hạn',
  learning: 'đang học',
  new: 'chưa học',
  none: 'chưa có trong kho',
  paused: 'tạm ngưng',
};

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
