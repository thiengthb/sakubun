'use client';

import Link from 'next/link';
import { House, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/layout/page-state';
import {
  ErrorDigest,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';

export default function RouteError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

  return (
    <PageState
      icon={TriangleAlert}
      tone="alert"
      title="Trang này không tải được"
      description="Thử lại thường là xong."
      action={
        <>
          <Button size="lg" onClick={reset}>
            <RotateCcw />
            Thử lại
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/">
              <House />
              Về trang chính
            </Link>
          </Button>
        </>
      }
    >
      <ErrorDigest digest={error.digest} />
    </PageState>
  );
}
