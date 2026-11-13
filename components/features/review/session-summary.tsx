'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getStreakAction } from '@/app/actions';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { kanjiHref } from '@/components/common/kanji-detail';
import type { QuickCard } from '@/lib/app/quick-review';
import { humanizeUntil } from '@/lib/core/format';
import { summarizeSession, type SessionAnswer } from '@/lib/domain/session-summary';

/** One answer of the session, with what the summary needs to show and link the card. */
export interface SessionResult extends SessionAnswer {
  kind: QuickCard['kind'];
  expression: string;
  meaningVi: string;
}

const KINDS: [QuickCard['kind'], string][] = [
  ['GRAMMAR', 'Ngữ pháp'],
  ['VOCAB', 'Từ vựng'],
  ['KANJI', 'Kanji'],
];

const itemHref = (r: SessionResult) =>
  r.kind === 'KANJI' ? kanjiHref(r.expression) : `/resources/${r.itemId}`;

/**
 * U2d (docs/plans/2026-11-13-u2-study-session.md): the end of a session, the moment it is
 * remembered by. Three figures (cards done, the share remembered, the streak), at most three cards
 * worth a second look, each a link to its page, and one thing to do next. All of it comes from
 * the session on the device, except the streak, read once the last answer is in.
 */
export function SessionSummary({
  results,
  nextDueAt,
}: {
  results: SessionResult[];
  nextDueAt: Date | null;
}) {
  const s = summarizeSession(results);
  // undefined while loading, null if it could not be read: the tile then steps aside.
  const [streak, setStreak] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getStreakAction()
      .then((r) => alive && setStreak(r.ok ? r.data.current : null))
      .catch(() => alive && setStreak(null));
    return () => {
      alive = false;
    };
  }, []);

  // Remembered per kind, for a session that mixed them: "Ngữ pháp 2/3 nhớ".
  const byKind = KINDS.flatMap(([kind, label]) => {
    const of = results.filter((r) => r.kind === kind && !r.intro);
    if (of.length === 0) return [];
    const kept = summarizeSession(of).remembered;
    return [[label, `${kept}/${of.length} nhớ`]];
  });
  const tiles: [string, ReactNode][] = [
    ['Đã ôn', `${s.reviewed} thẻ`],
    ...(s.rate === null ? [] : ([['Nhớ', `${s.rate}%`]] as [string, string][])),
    ...(streak === null
      ? []
      : ([
          [
            'Chuỗi ngày',
            streak === undefined ? <Skeleton className="h-7 w-16" /> : `${streak} ngày`,
          ],
        ] as [string, ReactNode][])),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold">Xong buổi ôn</h2>
        <p className="text-muted-foreground tabular-nums">
          {s.tested > 0 && `Nhớ ${s.remembered} trên ${s.tested} thẻ. `}
          {s.met > 0 && `Đã làm quen ${s.met} mục mới. `}
          {nextDueAt && `Thẻ tiếp theo đến hạn ${humanizeUntil(nextDueAt)}.`}
        </p>
      </div>
      {byKind.length > 0 && (
        <p className="-mt-3 flex flex-wrap gap-x-4 text-sm text-muted-foreground tabular-nums">
          {byKind.map(([label, value]) => (
            <span key={label}>
              {label} {value}
            </span>
          ))}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-3">
        {tiles.map(([label, value]) => (
          <Card key={label} size="sm" className="gap-1 px-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex h-7 items-center text-lg font-bold tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>
      {s.toReview.length > 0 && (
        <section className="space-y-2" aria-labelledby="to-review">
          <h3 id="to-review" className="font-semibold">
            Xem lại thẻ chưa nhớ
          </h3>
          <Card size="sm" className="gap-0 py-0">
            <ul className="divide-y divide-border">
              {s.toReview.map((r) => (
                <li key={r.itemId}>
                  <Link
                    href={itemHref(r)}
                    className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-muted"
                  >
                    <span lang="ja" className="text-lg">
                      {r.expression}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {r.meaningVi}
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
      <div className="space-y-1 rounded-lg bg-muted p-4">
        <p className="font-semibold">Còn sức? Dịch một câu với Claude</p>
        <p className="text-muted-foreground">
          Mở Claude, gõ “học”. Claude lấy đúng một mẫu đến hạn để bạn dịch.
        </p>
      </div>
    </div>
  );
}
