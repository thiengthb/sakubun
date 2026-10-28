'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/layout/page-state';
import { RootDocument } from '@/components/layout/root-document';
import {
  ErrorDigest,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';
import './globals.css';

// The root layout itself failed, so this replaces it: same document and the same PageState and
// Button as app/error.tsx, only without the sidebar (AppShell lives in the layout that broke).
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

  return (
    <RootDocument>
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 sm:px-6">
        <PageState
          icon={TriangleAlert}
          tone="alert"
          title="Sakubun không mở được"
          description="Tải lại trang thường là xong."
          action={
            <Button size="lg" onClick={reset}>
              <RotateCcw />
              Tải lại
            </Button>
          }
        >
          <ErrorDigest digest={error.digest} />
        </PageState>
      </main>
    </RootDocument>
  );
}
