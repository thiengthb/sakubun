'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/components/common/use-server-action';
import { takeGroupAction } from '@/app/library/actions';

// The empty dashboard's way in (phase 8, L4): take OpenJLPT's N5 grammar in one go, or browse.
export function StartFromLibrary({
  starter,
}: {
  starter: { id: string; name: string | null } | null;
}) {
  const router = useRouter();
  const take = useServerAction(takeGroupAction, {
    success: (r) => `Đã lấy ${r.added} mẫu về kho`,
    onSuccess: () => router.refresh(),
  });
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {starter && (
        <Button onClick={() => take.run(starter.id)} disabled={take.isPending}>
          <Download aria-hidden />
          Lấy bộ {starter.name}
        </Button>
      )}
      <Button asChild variant="outline">
        <Link href="/library">
          Mở Kho chung <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
