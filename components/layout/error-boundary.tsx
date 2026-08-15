'use client';

import { useEffect } from 'react';

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
