'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import './globals.css';

/**
 * Last-resort boundary: catches an error thrown by the ROOT LAYOUT itself, where `app/error.tsx` can't
 * help. It REPLACES the root layout, so it must ship its own `<html>`/`<body>` — and it can't rely on
 * the layout's next/font vars or ThemeProvider, hence plain classes and no shadcn `Button` (a crash
 * here may well be why the component tree failed). `globals.css` is imported directly so the tokens
 * still resolve.
 *
 * Same rule as `error.tsx`: never render the error text — only the digest.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-background p-6 text-foreground">
        <div className="flex flex-col items-center gap-5 text-center">
          <TriangleAlert className="size-10 text-alert" aria-hidden />
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold">Ứng dụng gặp lỗi nghiêm trọng</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              sakubun không khởi động được giao diện. Dữ liệu trong volume không bị ảnh hưởng. Thử
              tải lại; nếu vẫn lỗi, xem log bằng{' '}
              <code className="font-mono">docker logs sakubun</code>.
            </p>
          </div>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Mã lỗi: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            <RotateCcw className="size-4" aria-hidden />
            Tải lại
          </button>
        </div>
      </body>
    </html>
  );
}
