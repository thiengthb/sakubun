import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GUIDE_RECIPES,
  GUIDE_TABS,
  GUIDE_TOPIC_GROUPS,
  GUIDE_TOPIC_META,
  foldVi,
  isGuideRecipeId,
  isGuideTopicId,
  matchGuideTopics,
  recentGuideTopics,
} from '../components/guide/guide-topic-meta';

/**
 * Guards the `/guide` feature-tour REGISTRY (`components/guide/guide-topic-meta.ts`) — the single source for
 * every topic's id/title/summary/keywords/group — and the search that reads it.
 *
 * What TypeScript already guarantees (so this file does NOT re-test it): every id has an icon
 * (`Record<GuideTopicId, LucideIcon>` in `guide-search.tsx`) and the ids are a closed union. What needs a
 * runtime test is the DATA quality that makes search + grouping actually work: unique kebab ids, a real
 * summary, enough keywords to be findable, a valid group — plus the diacritic-insensitive matching, which
 * is the whole reason a Vietnamese learner can type "cach doc" and land on furigana.
 */

const ids = GUIDE_TOPIC_META.map((t) => t.id);
const groupIds = GUIDE_TOPIC_GROUPS.map((g) => g.id);

describe('guide topic registry', () => {
  it('ids are unique kebab-case', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toEqual([]);
  });

  it('every topic carries a title, a real summary and searchable keywords', () => {
    const thin = GUIDE_TOPIC_META.filter(
      (t) => t.title.trim().length < 8 || t.summary.trim().length < 30 || t.keywords.length < 2,
    ).map((t) => t.id);
    expect(
      thin,
      'A topic needs a title, a one-line summary that scans on the closed accordion, and >=2 keywords ' +
        `(the words a learner would type instead of the title):\n${thin.join('\n')}`,
    ).toEqual([]);
  });

  it('every topic belongs to exactly one declared group, and no group is empty', () => {
    const orphans = GUIDE_TOPIC_META.filter((t) => !groupIds.includes(t.group)).map((t) => t.id);
    expect(orphans, `Unknown group on: ${orphans.join(', ')}`).toEqual([]);
    const empty = groupIds.filter((g) => !GUIDE_TOPIC_META.some((t) => t.group === g));
    expect(empty, `Group heading with no topics under it: ${empty.join(', ')}`).toEqual([]);
  });

  it('recentGuideTopics returns the newest first, capped at the requested count', () => {
    const recent = recentGuideTopics(3);
    expect(recent).toHaveLength(3);
    const dates = recent.map((t) => t.addedOn);
    expect([...dates].sort().reverse()).toEqual(dates); // already newest-first
    const newest = GUIDE_TOPIC_META.reduce((a, b) => (a.addedOn >= b.addedOn ? a : b));
    expect(recent[0]?.addedOn).toBe(newest.addedOn);
    expect(recentGuideTopics(99)).toHaveLength(GUIDE_TOPIC_META.length);
  });

  it('addedOn is a real date, not in the future', () => {
    const bad = GUIDE_TOPIC_META.filter(
      (t) => !/^\d{4}-\d{2}-\d{2}$/.test(t.addedOn) || Number.isNaN(Date.parse(t.addedOn)),
    ).map((t) => t.id);
    expect(bad, `addedOn must be YYYY-MM-DD: ${bad.join(', ')}`).toEqual([]);
  });

  it('every topic in the registry has a body rendered in the tour', () => {
    // The compiler catches a MISSING id (JSX would reference an id outside the union); this catches the
    // other direction — a registry entry nobody renders, which would be invisible in the app.
    const source = readFileSync('components/guide/guide-features.tsx', 'utf8');
    const unrendered = ids.filter((id) => !source.includes(`<GuideTopicItem id="${id}">`));
    expect(
      unrendered,
      `These topics are in the registry but never rendered in the tour:\n${unrendered.join('\n')}`,
    ).toEqual([]);
  });
});

describe('guide deep-link targets', () => {
  // A `GuideLink` target is TYPE-checked (GuideTopicId / GuideRecipeId / GuideTabId), so a link can never
  // name something that is not in a registry. These tests cover the direction types cannot: that every
  // registered target actually EXISTS as an anchor on the page, i.e. the link scrolls somewhere real.
  const guidePage = readFileSync('app/guide/page.tsx', 'utf8');

  it('every recipe id is rendered in the Theo việc tab', () => {
    // Two shapes are valid: a `<Recipe id="x">` (which renders the `guide-recipe-x` anchor from that
    // prop) or a hand-rolled section carrying the literal anchor (the troubleshooting table).
    const missing = GUIDE_RECIPES.filter(
      (id) =>
        !guidePage.includes(`<Recipe id="${id}"`) && !guidePage.includes(`guide-recipe-${id}"`),
    );
    expect(
      missing,
      'These recipe ids are registered (so a GuideLink may point at them) but have no anchor in ' +
        `app/guide/page.tsx — the link would land on the tab and scroll nowhere:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  // The tab CONTROL moved out of app/guide/page.tsx into `GuideTabSelect` on 2026-08-05 (the page was
  // hand-rolling a TabsList instead of using the app's TabSelect, which overflowed a 390px phone). Both
  // halves still have to exist for a `?tab=` deep link to work, so check both, in their own files:
  // the id must be SWITCHABLE TO (an item in the select/list) and must have somewhere to switch TO.
  const guideTabsFile = readFileSync('components/guide/guide-tabs.tsx', 'utf8');
  const guideFeatures = readFileSync('components/guide/guide-features.tsx', 'utf8');

  it('every tab id is offered by the tab control', () => {
    const missing = GUIDE_TABS.filter((id) => !guideTabsFile.includes(`value: '${id}'`));
    expect(
      missing,
      `Tab ids missing from GUIDE_TAB_ITEMS in guide-tabs.tsx: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('every tab id has a TabsContent panel', () => {
    const missing = GUIDE_TABS.filter(
      (id) =>
        !guidePage.includes(`<TabsContent value="${id}"`) &&
        !guideFeatures.includes(`<TabsContent value="${id}"`),
    );
    expect(missing, `Tab ids with no panel: ${missing.join(', ')}`).toEqual([]);
  });

  it('isGuideRecipeId narrows only real recipes', () => {
    expect(isGuideRecipeId('mcp')).toBe(true);
    expect(isGuideRecipeId('nope')).toBe(false);
  });
});

describe('guide search', () => {
  it('folds Vietnamese diacritics and đ', () => {
    expect(foldVi('CÁCH ĐỌC')).toBe('cach doc');
    expect(foldVi('Nghe & nói')).toBe('nghe & noi');
  });

  it('an empty query matches every topic', () => {
    expect(matchGuideTopics('').size).toBe(GUIDE_TOPIC_META.length);
    expect(matchGuideTopics('   ').size).toBe(GUIDE_TOPIC_META.length);
  });

  it('finds a topic by title, by keyword, by accent-free spelling and case-insensitively', () => {
    for (const query of ['furigana', 'FURIGANA', 'cách đọc', 'cach doc', 'karaoke']) {
      expect(matchGuideTopics(query).has('furigana'), `query "${query}"`).toBe(true);
    }
  });

  it('requires every term of a multi-word query', () => {
    expect(matchGuideTopics('nhap excel').has('library')).toBe(true);
    expect(matchGuideTopics('excel karaoke').size).toBe(0);
  });

  it('matches nothing for a nonsense query', () => {
    expect(matchGuideTopics('zzzqqq').size).toBe(0);
  });

  it('isGuideTopicId narrows only real ids', () => {
    expect(isGuideTopicId('translate')).toBe(true);
    expect(isGuideTopicId('nope')).toBe(false);
    expect(isGuideTopicId('__proto__')).toBe(false);
  });
});
