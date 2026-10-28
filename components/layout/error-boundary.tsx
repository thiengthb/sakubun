'use client';

import { useEffect } from 'react';

export interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Shared by app/error.tsx and app/global-error.tsx. Both draw with PageState and Button, so an error
// page follows the app's style instead of keeping a hand-drawn copy of it.

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
