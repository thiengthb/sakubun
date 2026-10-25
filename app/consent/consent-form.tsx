'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth/auth-client';
import { Check, Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/layout/auth-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';

export type ConsentRequest = {
  clientName: string | null;
  redirectHost: string | null;
};

// What the MCP tools can do, in the words of the pages that show the same data.
const CAN = ['Xem lịch ôn và kho tài nguyên', 'Soạn câu và chấm bài', 'Thêm mục mới vào kho'];

export function ConsentForm({ request }: { request: ConsentRequest | null }) {
  const [pending, setPending] = useState<'accept' | 'deny' | null>(null);

  if (!request) {
    return (
      <AuthCard title="Yêu cầu không hợp lệ">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Liên kết đã hết hạn hoặc bị sửa. Kết nối lại từ ứng dụng vừa mở trang này.
          </p>
        </CardContent>
      </AuthCard>
    );
  }

  // The auth client follows the redirect answer back to the app that asked.
  async function decide(accept: boolean) {
    setPending(accept ? 'accept' : 'deny');
    const { error } = await authClient.oauth2.consent({ accept });
    if (error) {
      setPending(null);
      toast.error(error.message ?? 'Không gửi được lựa chọn. Thử lại.');
    }
  }

  return (
    <AuthCard
      title="Cho phép truy cập Sakubun?"
      description={`${request.clientName ?? 'Một ứng dụng không ghi tên'} sẽ được:`}
    >
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {CAN.map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-ok" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Gửi quyền về{' '}
          <span className="font-medium text-foreground">
            {request.redirectHost ?? 'không rõ địa chỉ'}
          </span>
        </p>
        <p className="rounded-sm bg-warn-wash px-3 py-2 text-sm text-warn">
          Chỉ cho phép nếu bạn vừa tự kết nối từ ứng dụng này.
        </p>
        <div className="flex gap-2">
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={pending !== null}
            onClick={() => void decide(false)}
          >
            {pending === 'deny' && <Loader2 className="animate-spin" />}
            Từ chối
          </Button>
          <Button
            size="lg"
            className="flex-1"
            disabled={pending !== null}
            onClick={() => void decide(true)}
          >
            {pending === 'accept' && <Loader2 className="animate-spin" />}
            Cho phép
          </Button>
        </div>
      </CardContent>
    </AuthCard>
  );
}
