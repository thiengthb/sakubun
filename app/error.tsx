'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { House, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RouteError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-8 text-center">
      <TriangleAlert className="size-10 text-alert" aria-hidden />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Có lỗi xảy ra</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Trang này không tải được. Dữ liệu học của bạn vẫn an toàn — thử lại thường là xong. Nếu
          vẫn lỗi, kiểm tra container sakubun còn chạy không.
        </p>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Mã lỗi: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw />
          Thử lại
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <House />
            Về trang chủ
          </Link>
        </Button>
      </div>
    </div>
  );
}
