import Link from 'next/link';
import { BookOpen, House, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Không tìm thấy trang — sakubun' };

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 py-8 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
        <p className="max-w-md text-subhead text-muted-foreground">
          Đường dẫn này không tồn tại — có thể mục bạn mở đã bị xoá, hoặc link đã cũ.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <House />
            Về trang chủ
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/resources">
            <BookOpen />
            Kho tài nguyên
          </Link>
        </Button>
      </div>
    </div>
  );
}
