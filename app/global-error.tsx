'use client';

import {
  FatalErrorPanel,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';
import './globals.css';

// Renders when the root layout itself failed: no PageShell, no component library (see
// components/layout/error-boundary.tsx). The title matches PageShell's.
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-background px-4 py-10 text-foreground md:px-8">
        <main className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-lg leading-tight font-extrabold md:text-2xl">
            Sakubun không mở được
          </h1>
          <FatalErrorPanel digest={error.digest} onReset={reset} />
        </main>
      </body>
    </html>
  );
}
