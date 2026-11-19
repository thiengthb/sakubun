'use client';

import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { AddButton } from '@/components/common/add-button';
import { LIST_CARD } from '@/components/common/list-card';
import { ButtonLink } from '@/components/ui/button';
import { setSummary, STATE_LABEL } from '@/lib/library/level-screen';
import type { OutsideShelves, Shelf } from '@/lib/library/outside-shelves';
import { cn } from '@/lib/core/utils';
import { MARK } from './word-marks';

// "Ngoài JLPT" (U4e, layout B that thien picked on 19/11, docs/plans/2026-11-14-u4-kho.md): the
// learner's groups, then the items outside JLPT by where they came from. Each is a card like a set
// of the level screen: a mark per item, a summary line, and one action; the card opens its list.

export const OUTSIDE_TITLE = 'Ngoài JLPT';

export function outsideMeta(shelves: OutsideShelves): string {
  return `${shelves.outside} mục không thuộc N5–N1 · ${shelves.groups.length} nhóm · ${shelves.mastered} đã thuộc`;
}

export function OutsideView({ shelves }: { shelves: OutsideShelves }) {
  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="resources" self />}
      title={OUTSIDE_TITLE}
      meta={outsideMeta(shelves)}
      actions={<AddButton href="/resources/new" />}
    >
      <div className="flex flex-col gap-6">
        <ShelfSection
          id="outside-groups"
          title="Nhóm của bạn"
          note="Nhóm bạn tự lập, có thể gồm cả mục JLPT"
          shelves={shelves.groups}
          empty={
            <>
              Chưa có nhóm nào.{' '}
              <Link href="/groups/new" className="underline underline-offset-2">
                Tạo nhóm
              </Link>
            </>
          }
        />
        <ShelfSection
          id="outside-sources"
          title="Theo nguồn"
          note="Mọi mục ngoài JLPT, kể cả mục đã vào nhóm"
          shelves={shelves.sources}
          empty="Chưa có mục nào ngoài JLPT. Bấm Thêm để tự viết, nhờ Claude soạn hay lấy bộ người khác chia sẻ."
        />
      </div>
    </PageShell>
  );
}

function ShelfSection({
  id,
  title,
  note,
  shelves,
  empty,
}: {
  id: string;
  title: string;
  note: string;
  shelves: Shelf[];
  empty: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-heading">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
      {shelves.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shelves.map((s) => (
            <ShelfCard key={s.key} shelf={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ShelfCard({ shelf }: { shelf: Shelf }) {
  const titleId = `shelf-${shelf.key}`;
  const more = shelf.size - shelf.marks.length;
  return (
    <li
      aria-labelledby={titleId}
      className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex flex-col gap-2 p-4')}
    >
      {/* A full-size link under the card opens its list (LIST_CARD); the action sits above it. */}
      <Link href={shelf.href} aria-labelledby={titleId} className={LIST_CARD.link} />
      <div className="flex min-h-9 items-center gap-2">
        <h3 id={titleId} className="min-w-0 flex-1 truncate font-semibold">
          {shelf.title}
        </h3>
        {shelf.action &&
          (shelf.action.href ? (
            <ButtonLink href={shelf.action.href} variant="outline" className="relative z-10">
              {shelf.action.label}
            </ButtonLink>
          ) : (
            <span className="relative rounded-full bg-ok-wash px-2 py-0.5 text-xs font-medium text-ok">
              {shelf.action.label}
            </span>
          ))}
      </div>
      {shelf.size > 0 && (
        <ul
          className="grid max-w-64 grid-cols-10 gap-1.5"
          aria-label={`Từng mục của ${shelf.title}`}
        >
          {shelf.marks.map((m) => (
            <li key={m.id} className={cn('aspect-square rounded-xs', MARK[m.state])}>
              <span className="sr-only">{`${m.expression}: ${STATE_LABEL[m.state]}`}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {[
          shelf.note,
          setSummary(shelf.counts),
          more > 0 ? `ô vẽ ${shelf.marks.length} mục đầu` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </li>
  );
}
