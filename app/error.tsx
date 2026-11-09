'use client';

import { House, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
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
          <ButtonLink href="/" size="lg" variant="outline">
            <House />
            Về trang chính
          </ButtonLink>
        </>
      }
    >
      <ErrorDigest digest={error.digest} />
    </PageState>
  );
}
