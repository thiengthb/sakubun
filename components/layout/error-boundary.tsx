'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Deliberately dependency-free: app/global-error.tsx renders when the root layout itself failed,
// so anything it imports has to be able to load in that state. Button, Link and the rest stay in
// app/error.tsx, which still has a working layout around it.

export function useLoggedError(error: Error): void {
  useEffect(() => {
    console.error(error);
  }, [error]);
}

export function ErrorDigest({ digest }: { digest?: string }) {
  if (!digest) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Mã lỗi: <code className="font-mono">{digest}</code>
    </p>
  );
}

/**
 * The root-layout failure, laid out like PageState but drawn by hand (PageState pulls in the
 * sidebar). The bare button sizes its icon the way Button does.
 */
export function FatalErrorPanel({ digest, onReset }: { digest?: string; onReset: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-alert-wash text-alert [&_svg]:size-8">
        <TriangleAlert aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold">Sakubun không mở được</h1>
        <p className="text-sm text-muted-foreground">Tải lại trang thường là xong.</p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
      >
        <RotateCcw aria-hidden />
        Tải lại
      </button>
      <ErrorDigest digest={digest} />
    </main>
  );
}
