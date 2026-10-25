import Link from 'next/link';
import { BookOpen, House, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Không tìm thấy trang — sakubun' };

export default function NotFound() {
  return (
    <PageShell template="form" title="Không tìm thấy trang">
      <EmptyState
        icon={SearchX}
        title="Đường dẫn này không có trang nào"
        description="Mục có thể đã bị xoá, hoặc liên kết đã cũ."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/">
                <House />
                Về trang chính
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/resources">
                <BookOpen />
                Mở Tài nguyên
              </Link>
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
