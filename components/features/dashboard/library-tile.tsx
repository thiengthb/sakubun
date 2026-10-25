'use client';

import { BookOpenText } from 'lucide-react';
import { StatTile } from '@/components/features/dashboard/dashboard-charts';

// The library's size as one total, with the grammar/vocabulary split as a bar and a legend under
// it. Two numbers side by side read as one odd value (thien, Phân tích rounds 1 and 2).
export function LibraryTile({
  grammar,
  vocab,
  explain,
}: {
  grammar: number;
  vocab: number;
  explain: string;
}) {
  const total = grammar + vocab;
  const share = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return (
    <StatTile
      icon={BookOpenText}
      tone="info"
      items={[{ value: total, label: 'Mục trong kho' }]}
      note={
        <span className="inline-flex flex-wrap items-center gap-x-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-info" aria-hidden />
            {grammar} ngữ pháp
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent-brand/70" aria-hidden />
            {vocab} từ vựng
          </span>
        </span>
      }
      explain={explain}
    >
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-info" style={{ width: `${share(grammar)}%` }} />
        <div className="bg-accent-brand/70" style={{ width: `${share(vocab)}%` }} />
      </div>
    </StatTile>
  );
}
