'use client';

import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { AddButton } from '@/components/common/add-button';
import { LIST_CARD } from '@/components/common/list-card';
import { SpokenLine } from '@/components/common/spoken-line';
import { speakable } from '@/lib/core/format';
import { STATE_LABEL } from '@/lib/library/level-screen';
import { wordState } from '@/lib/library/level-sets';
import { SOURCE_TITLE, type OutsideItem, type OutsideSource } from '@/lib/library/outside-shelves';
import { cn } from '@/lib/core/utils';
import { MARK } from './word-marks';
import { OUTSIDE_TITLE } from './outside-view';

// One source of "Ngoài JLPT" (U4e): its items oldest first, each opening the item's page. A full-size
// link lies under each row (LIST_CARD); the expression's play button sits above it.

export function OutsideList({
  source,
  items,
  now,
  tts,
}: {
  source: OutsideSource;
  items: OutsideItem[];
  now: Date;
  tts: { speaker: number; rate: number };
}) {
  return (
    <PageShell
      template="list"
      breadcrumb={
        <ParentCrumbs
          section="resources"
          self
          record={{ label: OUTSIDE_TITLE, href: '/resources/outside' }}
        />
      }
      title={SOURCE_TITLE[source]}
      meta={`${items.length} mục ngoài JLPT`}
      actions={<AddButton href="/resources/new" />}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có mục nào từ nguồn này.</p>
      ) : (
        <ul className={cn(LIST_CARD.base, 'divide-y divide-border p-0')}>
          {items.map((item) => {
            const state = wordState(item, now);
            return (
              <li
                key={item.id}
                className={cn(
                  'relative flex min-h-11 items-center gap-3 px-4 py-2.5',
                  LIST_CARD.linked,
                )}
              >
                <Link
                  href={`/resources/${item.id}`}
                  aria-label={`Mở ${item.expression}`}
                  className={LIST_CARD.link}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <SpokenLine
                    text={item.expression}
                    speakText={speakable(item.expression)}
                    speaker={tts.speaker}
                    rate={tts.rate}
                    truncate
                    className="font-semibold"
                  />
                  <span className="truncate text-sm">
                    {item.reading && (
                      <span lang="ja" className="text-muted-foreground">
                        {item.reading} ·{' '}
                      </span>
                    )}
                    {item.meaningVi}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden className={cn('size-3 rounded-xs', MARK[state])} />
                  <span className="first-letter:uppercase">{STATE_LABEL[state]}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
