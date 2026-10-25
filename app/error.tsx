'use client';

import Link from 'next/link';
import { House, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { PageShell } from '@/components/layout/page-shell';
import {
  ErrorDigest,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';

// The layout still works around this boundary, so the page keeps the app's header and menu and
// says what happened in the same dashed box as every other empty page (docs/ui-standard.md).
export default function RouteError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

  return (
    <PageShell template="form" title="Có lỗi xảy ra">
      <EmptyState
        icon={TriangleAlert}
        title="Trang này không tải được"
        description="Dữ liệu học vẫn an toàn. Thử lại thường là xong."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={reset}>
              <RotateCcw />
              Thử lại
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <House />
                Về trang chính
              </Link>
            </Button>
          </div>
        }
      >
        <ErrorDigest digest={error.digest} />
      </EmptyState>
    </PageShell>
  );
}
