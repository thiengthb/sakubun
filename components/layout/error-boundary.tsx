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
 * The root-layout failure, in EmptyState's dashed box drawn by hand (EmptyState itself pulls in the
 * component library). The bare button sizes its icon the way Button does.
 */
export function FatalErrorPanel({ digest, onReset }: { digest?: string; onReset: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border-2 border-dashed border-border px-4 py-5 md:px-6">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-bold">Ứng dụng gặp lỗi khi khởi động</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Dữ liệu học vẫn an toàn. Tải lại trang thường là xong.
        </p>
        <ErrorDigest digest={digest} />
        <div className="pt-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
          >
            <RotateCcw aria-hidden />
            Tải lại
          </button>
        </div>
      </div>
    </div>
  );
}
