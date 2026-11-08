import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { SectionHeading } from '@/components/common/section-heading';
import { KanjiFacts } from '@/components/common/kanji-detail';
import { KanjiStrokes } from '@/components/common/kanji-strokes';
import { KanjiNetwork } from '@/components/features/resources/kanji-network';
import { LIST_CARD } from '@/components/common/list-card';
import type { KanjiPage } from '@/lib/app/kanji-page';
import { withHanviet } from '@/lib/kanji/label';
import { cn } from '@/lib/core/utils';

// A kanji's page (KJ6, docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới): the glyph drawn in its
// stroke order beside its meaning and facts, then its component network.
export function KanjiPageView({ page }: { page: KanjiPage }) {
  const k = page.kanji;
  return (
    <PageShell
      template="detail"
      breadcrumb={<ParentCrumbs section="kanji" self />}
      title={withHanviet(k.kanji, k.hanviet)}
      meta={k.meaningVi || 'Chưa có nghĩa tiếng Việt.'}
    >
      <div className="space-y-8">
        <div className={cn(LIST_CARD.base, 'flex flex-col gap-5 p-5 sm:flex-row sm:items-start')}>
          {page.paths.length > 0 && (
            <KanjiStrokes
              paths={page.paths}
              animate
              label={k.kanji}
              className="size-32 shrink-0 self-center sm:self-start"
            />
          )}
          <div className="min-w-0 flex-1">
            <KanjiFacts kanji={k} />
          </div>
        </div>
        <section className="space-y-4">
          <SectionHeading
            level="page"
            title="Mạng lưới thành phần"
            hint="Chữ có chung thành phần với chữ này. Phần chỉ âm thường giữ âm Hán Việt: 吾 [NGÔ] trong 語 [NGỮ], 悟 [NGỘ]. Bấm một chữ để mở mạng lưới của nó."
          />
          <KanjiNetwork page={page} />
        </section>
      </div>
    </PageShell>
  );
}
