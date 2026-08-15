'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import {
  ErrorDigest,
  useLoggedError,
  type ErrorBoundaryProps,
} from '@/components/layout/error-boundary';
import './globals.css';

export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useLoggedError(error);

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
          <ErrorDigest digest={error.digest} />
          {/* A bare button, not <Button>: this boundary renders when the root layout failed, so it
              must not depend on the component library it is reporting the failure of. */}
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
