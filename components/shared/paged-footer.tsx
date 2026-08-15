'use client';

import { type RefObject } from 'react';
import { DataPagination } from '@/components/ui/data-pagination';
import type { PagedList } from '@/components/shared/use-paged-list';

// The footer every usePagedList view ends with. It owns the ref too: usePagedList measures the
// footer to decide how many rows fit, so the wrapper element and the hook must not drift apart.
export function PagedFooter<T>({
  paged,
  footerRef,
  noun,
  totalUnfiltered,
}: {
  paged: PagedList<T>;
  footerRef: RefObject<HTMLDivElement | null>;
  noun: string;
  totalUnfiltered: number;
}) {
  const end = Math.min(paged.start + paged.pageSize, paged.total);
  return (
    <div ref={footerRef}>
      <DataPagination
        count={
          <>
            {paged.start + 1}–{end} / {paged.total} {noun}
            {paged.total !== totalUnfiltered && ` (lọc từ ${totalUnfiltered})`}
          </>
        }
        page={paged.page}
        pageCount={paged.pageCount}
        onPageChange={paged.setPage}
        pageSize={paged.pageSize}
        pageSizeOptions={paged.sizeOptions}
        onPageSizeChange={paged.choosePageSize}
        autoFit={paged.autoFit}
        autoFitSize={paged.autoFitSize}
        onAutoFit={paged.onAutoFit}
      />
    </div>
  );
}
