'use client';

import {
  FatalErrorPanel,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';
import './globals.css';

// Renders when the root layout itself failed: no component library (see
// components/layout/error-boundary.tsx).
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <FatalErrorPanel digest={error.digest} onReset={reset} />
      </body>
    </html>
  );
}
