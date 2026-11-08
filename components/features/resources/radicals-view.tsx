import Link from 'next/link';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeading } from '@/components/common/section-heading';
import { LIST_CARD } from '@/components/common/list-card';
import { KANJI_GRID } from '@/components/common/kanji-tile';
import type { RadicalSummary } from '@/lib/app/radicals';
import { cn } from '@/lib/core/utils';

// Bộ thủ (KJ7, docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới): the 214 Kangxi radicals by
// stroke count, each with its Vietnamese name and how many of its Jōyō kanji the learner has met.

export const radicalHref = (number: number) => `/resources/radicals/${number}`;

export function RadicalsView({ radicals }: { radicals: RadicalSummary[] }) {
  const byStrokes = new Map<number, RadicalSummary[]>();
  for (const r of radicals) byStrokes.set(r.strokes, [...(byStrokes.get(r.strokes) ?? []), r]);
  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="kanji" self />}
      title="Bộ thủ"
      meta={`${radicals.length} bộ Khang Hy, xếp theo số nét`}
    >
      <div className="space-y-6">
        {[...byStrokes].map(([strokes, list]) => (
          <section key={strokes} className="space-y-2" aria-label={`Bộ ${strokes} nét`}>
            <SectionHeading title={`${strokes} nét`} />
            <div className="@container">
              <ul className={KANJI_GRID}>
                {list.map((r) => (
                  <RadicalTile key={r.number} radical={r} />
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

function RadicalTile({ radical: r }: { radical: RadicalSummary }) {
  return (
    <li data-slot="radical-tile" className="flex">
      <Link
        href={radicalHref(r.number)}
        aria-label={`Bộ ${r.radical} ${r.nameVi}: ${r.joyo} chữ Jōyō, đã gặp ${r.met}`}
        className={cn(
          LIST_CARD.base,
          'flex aspect-square w-full min-w-0 flex-col items-center justify-center gap-0.5 p-1 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <span lang="ja" className="text-3xl leading-none">
          {r.radical}
          {r.variants.length > 0 && (
            <span className="ml-0.5 align-top text-sm text-muted-foreground">
              {r.variants.join(' ')}
            </span>
          )}
        </span>
        <span className="max-w-full truncate text-xs">{r.nameVi}</span>
        <span
          className={cn(
            'text-xs tabular-nums',
            r.met > 0 && r.met >= r.joyo ? 'text-ok' : 'text-muted-foreground',
          )}
        >
          {r.met}/{r.joyo}
        </span>
      </Link>
    </li>
  );
}
