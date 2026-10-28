import { LIST_CARD } from '@/components/common/list-card';
import { RemoveEntryButton } from '@/components/common/remove-entry-button';
import { RelativeTime } from '@/components/common/relative-time';
import { cn } from '@/lib/core/utils';

export interface AccountShare {
  id: string;
  type: string;
  expression: string | null;
  name: string | null;
  meaningVi: string | null;
  level: string | null;
  status: string;
  takeCount: number;
  likes: number;
  createdAt: Date;
}

const TYPE_LABEL: Record<string, string> = { GRAMMAR: 'Ngữ pháp', VOCAB: 'Từ vựng', GROUP: 'Nhóm' };
const STATUS_LABEL: Record<string, string> = {
  public: 'Đang hiện',
  hidden: 'Tác giả đã gỡ',
  removed: 'Quản trị đã ẩn',
  orphan: 'Tài khoản đã xoá',
};

// What one account has shared on Kho chung (phase 8, L6), for the admin to hide or show again.
export function AccountShares({ shares }: { shares: AccountShare[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">Đã chia sẻ lên Kho chung</h2>
      <div className="@container">
        <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3">
          {shares.map((s) => {
            const label = s.name ?? s.expression ?? '';
            return (
              <li
                key={s.id}
                data-slot="account-share"
                className={cn(LIST_CARD.base, 'flex min-w-0 items-start justify-between gap-2')}
              >
                <div className="min-w-0 space-y-1">
                  <p lang={s.type === 'GROUP' ? undefined : 'ja'} className="truncate font-bold">
                    {label}
                  </p>
                  {s.meaningVi && (
                    <p className="line-clamp-1 text-muted-foreground">{s.meaningVi}</p>
                  )}
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{TYPE_LABEL[s.type] ?? s.type}</span>
                    {s.level && <span>· {s.level}</span>}
                    <span>· {STATUS_LABEL[s.status] ?? s.status}</span>
                    <span>· {s.takeCount} lượt lấy</span>
                    <span>· {s.likes} lượt thích</span>
                    <span>
                      · <RelativeTime value={s.createdAt} />
                    </span>
                  </p>
                </div>
                {(s.status === 'public' || s.status === 'removed') && (
                  <RemoveEntryButton entryId={s.id} removed={s.status === 'removed'} name={label} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
