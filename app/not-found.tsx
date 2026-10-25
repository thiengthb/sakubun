import Link from 'next/link';
import { BookOpen, FileQuestion, House } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/layout/page-state';

export const metadata = { title: 'Không tìm thấy trang — sakubun' };

export default function NotFound() {
  return (
    <PageState
      icon={FileQuestion}
      title="Không tìm thấy trang"
      description="Liên kết có thể đã cũ."
      action={
        <>
          <Button size="lg" asChild>
            <Link href="/">
              <House />
              Về trang chính
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/resources">
              <BookOpen />
              Mở Tài nguyên
            </Link>
          </Button>
        </>
      }
    />
  );
}
