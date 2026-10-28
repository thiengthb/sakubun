'use client';

import Link from 'next/link';
import { BookCheck, Download, Layers, UserRound } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { SpokenLine } from '@/components/common/spoken-line';
import { useServerAction } from '@/components/common/use-server-action';
import { takeEntryAction } from '@/app/library/actions';
import { LibraryAdminMenu } from '@/components/features/library/library-admin-menu';
import { ORIGIN_LABEL } from '@/components/features/library/library-entry-card';
import { LikeButton } from '@/components/features/library/like-button';
import type { ClozeExample } from '@/lib/domain/cloze';
import { speakable } from '@/lib/core/format';
import { isGroupKind } from '@/lib/library/group-kinds';
import { splitPatternLabel } from '@/lib/library/pattern-label';

export interface LibraryItemDetail {
  id: string;
  type: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string | null;
  level: string | null;
  origin: string;
  author: string | null;
  takeCount: number;
  likes: number;
  liked: boolean;
  groups: { id: string; name: string | null; groupKind: string | null }[];
  // The learner's own copy, when they have one (same kind and expression).
  itemId: string | null;
  formationVi: string | null;
  example: ClozeExample | null;
}

const TYPE_LABEL: Record<string, string> = { GRAMMAR: 'Ngữ pháp', VOCAB: 'Từ vựng' };

// Detail template (thien, 7.4i): one pattern or word on Kho chung, seen before it is taken. Its
// formation and example sentence come from data/openjlpt/examples.json when OpenJLPT has it; the
// groups it is in open their pages. "Lấy về kho" copies it, then the action opens the learner's copy.
export function LibraryItemView({
  entry,
  admin = false,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  entry: LibraryItemDetail;
  /** The admin gets Ẩn, behind a menu at the foot of the page (L6). */
  admin?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const take = useServerAction(takeEntryAction, {
    success: (r) => (r.already ? 'Đã có trong kho' : `Đã lấy ${entry.expression} về kho`),
  });
  const grammar = entry.type === 'GRAMMAR';
  const { pattern, label } = grammar
    ? splitPatternLabel(entry.expression)
    : { pattern: entry.expression, label: null };
  const reading = showFurigana && entry.reading && entry.reading !== entry.expression;
  const empty = !entry.formationVi && !entry.example && entry.groups.length === 0;

  return (
    <PageShell
      template="detail"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={
        <SpokenLine
          text={pattern}
          speakText={speakable(pattern)}
          speaker={voiceSpeaker}
          rate={speechRate}
          label={grammar ? 'Nghe mẫu' : 'Nghe từ'}
          title
          className="font-extrabold"
          aside={
            (reading || label) && (
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {reading ? `[${entry.reading}]` : label}
              </span>
            )
          }
        />
      }
      subtitle={
        <>
          <p>{entry.meaningVi}</p>
          {!grammar && entry.hanviet && (
            <p className="text-sm font-medium text-muted-foreground uppercase">
              <span className="sr-only">Âm Hán Việt: </span>[{entry.hanviet}]
            </p>
          )}
        </>
      }
      facts={[
        { label: 'Cấp độ', value: entry.level ?? '—' },
        { label: 'Loại', value: TYPE_LABEL[entry.type] ?? entry.type },
        {
          label: 'Nguồn',
          value:
            entry.origin === 'LEARNER' ? (
              <>
                <UserRound aria-hidden />
                {entry.author ?? 'Người dùng đã xoá'}
              </>
            ) : (
              (ORIGIN_LABEL[entry.origin] ?? entry.origin)
            ),
        },
        { label: 'Lượt lấy', value: entry.takeCount },
      ]}
      actions={
        entry.itemId ? (
          <ExpandingIconButton asChild icon={BookCheck} label="Mục của bạn">
            <Link href={`/resources/${entry.itemId}`} />
          </ExpandingIconButton>
        ) : (
          <Button onClick={() => take.run(entry.id)} disabled={take.isPending}>
            <Download aria-hidden />
            Lấy về kho
          </Button>
        )
      }
      pageIcons={
        <LikeButton
          entryId={entry.id}
          liked={entry.liked}
          likes={entry.likes}
          name={entry.expression}
        />
      }
    >
      <div className="space-y-6 md:space-y-8">
        {entry.formationVi && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Cách nối</h2>
            <p className="rounded-sm bg-muted px-3 py-1.5 text-base font-bold">
              {entry.formationVi}
            </p>
          </section>
        )}
        {entry.example && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Ví dụ</h2>
            <div
              data-slot="library-example"
              className="space-y-1 border-l-4 border-accent-brand/40 pl-3"
            >
              <SpokenLine
                text={entry.example.ja}
                ruby={entry.example.jaRuby}
                showFurigana={showFurigana}
                speaker={voiceSpeaker}
                rate={speechRate}
                label="Nghe ví dụ"
                lookup
                className="text-base"
              />
              {entry.example.vi && (
                <p className="text-sm text-muted-foreground">{entry.example.vi}</p>
              )}
            </div>
          </section>
        )}
        {entry.groups.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">Có trong nhóm</h2>
            <ul className="flex flex-wrap gap-2">
              {entry.groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/library/${g.id}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 truncate">{g.name}</span>
                    {g.groupKind && isGroupKind(g.groupKind) && (
                      <GroupKindBadge kind={g.groupKind} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {empty && <EmptyState icon={Layers} title="Mục này chưa có câu ví dụ hay nhóm nào." />}
        {admin && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Quản trị</span>
            <LibraryAdminMenu
              entryId={entry.id}
              name={entry.expression}
              back="/library?tab=items"
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
