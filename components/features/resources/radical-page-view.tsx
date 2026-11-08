'use client';

import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { EmptyState } from '@/components/common/empty-state';
import { KanjiNodeList, StudyLegend } from '@/components/features/resources/kanji-network';
import type { RadicalPage } from '@/lib/app/radicals';
import { Shapes } from 'lucide-react';

// One radical (KJ7): what it means, its other forms, and the Jōyō kanji filed under it, coloured by
// what the learner studied; each kanji opens its page and its component network.
export function RadicalPageView({ page }: { page: RadicalPage }) {
  const r = page.radical;
  return (
    <PageShell
      template="list"
      breadcrumb={
        <ParentCrumbs
          section="kanji"
          self
          record={{ label: 'Bộ thủ', href: '/resources/radicals' }}
        />
      }
      title={`Bộ ${r.radical} ${r.nameVi}`}
      meta={[
        r.meaningVi,
        `${r.strokes} nét`,
        `bộ số ${r.number}`,
        r.variants.length > 0 ? `dạng khác ${r.variants.join(' ')}` : null,
        `${r.joyo} chữ Jōyō, đã gặp ${r.met}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      {page.kanji.length === 0 ? (
        <EmptyState icon={Shapes} title="Không chữ Jōyō nào thuộc bộ này" />
      ) : (
        <div className="space-y-4">
          <StudyLegend />
          <KanjiNodeList nodes={page.kanji} limit={60} />
        </div>
      )}
    </PageShell>
  );
}
