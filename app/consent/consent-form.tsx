'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth/auth-client';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/layout/auth-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';

export type ConsentRequest = {
  clientName: string | null;
  redirectHost: string | null;
};

export function ConsentForm({ request }: { request: ConsentRequest | null }) {
  const [pending, setPending] = useState<'accept' | 'deny' | null>(null);

  if (!request) {
    return (
      <AuthCard title="Yêu cầu không hợp lệ" description="Liên kết đã hết hạn hoặc bị sửa">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quay lại ứng dụng vừa mở trang này và kết nối lại từ đầu.
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
      title="Cho phép truy cập sakubun?"
      description={request.clientName ?? 'Một ứng dụng không ghi tên'}
    >
      <CardContent className="space-y-4">
        <p className="text-sm">
          Ứng dụng này sẽ dùng được các công cụ học của sakubun bằng tài khoản của bạn: xem lịch ôn,
          soạn câu, chấm điểm và thêm mục.
        </p>
        <p className="text-sm">
          Quyền sẽ được gửi về:{' '}
          <span className="font-medium">{request.redirectHost ?? 'không rõ địa chỉ'}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Chỉ bấm Cho phép nếu bạn vừa tự kết nối sakubun từ ứng dụng này.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={pending !== null}
            onClick={() => void decide(false)}
          >
            {pending === 'deny' && <Loader2 className="animate-spin" />}
            Từ chối
          </Button>
          <Button className="flex-1" disabled={pending !== null} onClick={() => void decide(true)}>
            {pending === 'accept' && <Loader2 className="animate-spin" />}
            Cho phép
          </Button>
        </div>
      </CardContent>
    </AuthCard>
  );
}
