import { BookOpen, FileQuestion, House } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
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
          <ButtonLink href="/" size="lg">
            <House />
            Về trang chính
          </ButtonLink>
          <ButtonLink href="/resources" size="lg" variant="outline">
            <BookOpen />
            Mở Tài nguyên
          </ButtonLink>
        </>
      }
    />
  );
}
