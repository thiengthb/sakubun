'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ButtonLink } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useServerAction } from '@/components/common/use-server-action';
import {
  publishGroupAction,
  publishItemAction,
  publishScriptAction,
  unpublishGroupAction,
  unpublishItemAction,
  unpublishScriptAction,
} from '@/app/library/actions';
import type { GroupShareStatus, ItemShareStatus } from '@/lib/library/publish';
import type { ScriptShareStatus } from '@/lib/library/scripts';
import { cn } from '@/lib/core/utils';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

// "Chia sẻ" (phase 8, L3; scripts K7b) on an item's, a group's or a Kaiwa script's own page: a header action that opens what will
// go public, then Công khai, Cập nhật or Gỡ. Only the web shares (rule 4).

function ShareDialog({
  shared,
  title,
  description,
  children,
  publish,
  unpublish,
  canPublish,
  pending,
  open: openProp,
  onOpenChange,
}: {
  shared: boolean;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  publish: (() => void) | null;
  unpublish: () => void;
  canPublish: boolean;
  pending: boolean;
  /** Opened from elsewhere (a menu): no button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  return (
    <>
      {openProp === undefined && (
        <ExpandingIconButton
          icon={Globe}
          label={shared ? 'Đang chia sẻ' : 'Chia sẻ'}
          onClick={() => setOpen(true)}
          className={cn(shared && '[&>svg]:text-accent-brand')}
        />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            {shared ? (
              <Button variant="outline" onClick={unpublish} disabled={pending}>
                Gỡ khỏi Kho chung
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Đóng
              </Button>
            )}
            {publish && (
              <Button onClick={publish} disabled={pending || !canPublish}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {shared ? 'Cập nhật' : 'Công khai'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SHARED_NOTE =
  'Đi kèm: chữ, cách đọc, Hán Việt, nghĩa và cấp. Ghi chú, sao và lịch sử ôn vẫn là của riêng bạn.';

export function ItemShareButton({ itemId, status }: { itemId: string; status: ItemShareStatus }) {
  const publish = useServerAction(publishItemAction, {
    success: (r) => (r.created ? 'Đã công khai lên Kho chung' : 'Đã cập nhật bản chia sẻ'),
  });
  const unpublish = useServerAction(unpublishItemAction, { success: 'Đã gỡ khỏi Kho chung' });
  const { shared, blocked, basedOn } = status;
  return (
    <ShareDialog
      shared={!!shared}
      title={shared ? 'Đang chia sẻ trên Kho chung' : 'Chia sẻ lên Kho chung'}
      description={
        blocked ??
        (shared
          ? `${shared.takeCount} lượt lấy. ${shared.changed ? 'Mục đã sửa từ lần chia sẻ trước.' : 'Bản chia sẻ đang khớp với mục.'} Gỡ thì người đã lấy vẫn giữ bản của họ.`
          : 'Người học khác sẽ tìm thấy và lấy được một bản sao của mục này.')
      }
      publish={blocked ? null : () => publish.run(itemId)}
      unpublish={() => unpublish.run(itemId)}
      canPublish={!shared || shared.changed}
      pending={publish.isPending || unpublish.isPending}
    >
      {!blocked && (
        <p className="text-muted-foreground">
          {SHARED_NOTE}
          {basedOn && ' Bản chia sẻ ghi là dựa trên mục bạn đã lấy từ Kho chung.'}
        </p>
      )}
    </ShareDialog>
  );
}

const ACTION_LABEL: Record<GroupShareStatus['preview'][number]['action'], string> = {
  new: 'Mục mới',
  update: 'Cập nhật',
  reuse: 'Dùng bản gốc',
  same: 'Đã chia sẻ',
  removed: 'Quản trị đã ẩn, không đưa lên',
};

export function GroupShareButton({
  groupId,
  status,
}: {
  groupId: string;
  status: GroupShareStatus;
}) {
  const publish = useServerAction(publishGroupAction, {
    success: (r) =>
      r.created ? `Đã công khai nhóm và ${r.items} mục` : 'Đã cập nhật nhóm trên Kho chung',
  });
  const unpublish = useServerAction(unpublishGroupAction, { success: 'Đã gỡ nhóm khỏi Kho chung' });
  const { shared, preview, blocked } = status;
  return (
    <ShareDialog
      shared={!!shared}
      title={shared ? 'Nhóm đang chia sẻ trên Kho chung' : 'Chia sẻ nhóm lên Kho chung'}
      description={
        blocked ??
        (preview.length === 0
          ? 'Nhóm còn trống. Thêm mục vào nhóm rồi mới công khai được.'
          : shared
            ? `${shared.takeCount} lượt lấy. Cập nhật để Kho chung theo đúng nhóm bây giờ. Gỡ nhóm thì các mục đã chia sẻ vẫn ở lại, gỡ từng mục ở trang của mục.`
            : `Nhóm và ${preview.length} mục dưới đây sẽ lên Kho chung. Nhóm ghi tên tài khoản của bạn là người chia sẻ. Mục không có trong nhóm vẫn riêng tư.`)
      }
      publish={preview.length && !blocked ? () => publish.run(groupId) : null}
      unpublish={() => unpublish.run(groupId)}
      canPublish={preview.length > 0}
      pending={publish.isPending || unpublish.isPending}
    >
      {preview.length > 0 && (
        <>
          <ul className="max-h-60 divide-y overflow-y-auto rounded-md ring-1 ring-foreground/10">
            {preview.map((p) => (
              <li
                key={p.itemId}
                className="flex min-w-0 items-center justify-between gap-3 px-3 py-1.5"
              >
                <span lang="ja" className="min-w-0 truncate">
                  {p.expression}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ACTION_LABEL[p.action]}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{SHARED_NOTE}</p>
        </>
      )}
    </ShareDialog>
  );
}

// The shared script's own page, to send to a friend: anyone with it reads the script, signed in or
// not (thien, 2026-11-07).
function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Đã chép đường dẫn', { description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không chép được, hãy chép đường dẫn trên trang chung', { description: url });
    }
  };
  const Icon = copied ? Check : Copy;
  return (
    <div data-slot="share-link" className="space-y-2">
      <p className="text-muted-foreground">
        Gửi đường dẫn này cho bạn bè: ai có nó cũng đọc được kịch bản, kể cả khi chưa đăng nhập.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Icon className={cn(copied && 'text-ok')} aria-hidden />
          {copied ? 'Đã chép' : 'Chép đường dẫn'}
        </Button>
        <ButtonLink href={path} variant="outline" size="sm">
          <ExternalLink aria-hidden />
          Mở trang chung
        </ButtonLink>
      </div>
    </div>
  );
}

// A Kaiwa script (K7b): the share is a copy of the script as it is now, title and lines; editing the
// script later does not change it until Cập nhật.
export function ScriptShareButton({
  scriptId,
  status,
  open,
  onOpenChange,
}: {
  scriptId: string;
  status: ScriptShareStatus;
  /** Opened from Hội thoại's menu instead of a button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const publish = useServerAction(publishScriptAction, {
    success: (r) => (r.created ? 'Đã công khai lên Kho chung' : 'Đã cập nhật bản chia sẻ'),
  });
  const unpublish = useServerAction(unpublishScriptAction, { success: 'Đã gỡ khỏi Kho chung' });
  const { shared, blocked, basedOn } = status;
  return (
    <ShareDialog
      shared={!!shared}
      title={shared ? 'Kịch bản đang chia sẻ trên Kho chung' : 'Chia sẻ kịch bản lên Kho chung'}
      description={
        blocked ??
        (shared
          ? `${shared.takeCount} lượt lấy. ${shared.changed ? 'Kịch bản đã sửa từ lần chia sẻ trước: Cập nhật để Kho chung có bản mới.' : 'Bản chia sẻ đang khớp với kịch bản.'} Gỡ thì người đã lấy vẫn giữ bản của họ.`
          : 'Người học khác sẽ đọc được kịch bản này trên Kho chung và lấy một bản sao về Hội thoại của họ.')
      }
      publish={blocked ? null : () => publish.run(scriptId)}
      unpublish={() => unpublish.run(scriptId)}
      canPublish={!shared || shared.changed}
      pending={publish.isPending || unpublish.isPending}
      open={open}
      onOpenChange={onOpenChange}
    >
      {shared && <ShareLink path={`/library/script/${shared.entryId}`} />}
      {!blocked && (
        <p className="text-muted-foreground">
          Đi kèm: tiêu đề và mọi câu, cả nghĩa. Bản chia sẻ ghi tên tài khoản của bạn và ai có đường
          dẫn cũng đọc được; sửa kịch bản sau này không tự đổi bản chia sẻ.
          {basedOn && ' Bản chia sẻ ghi là dựa trên kịch bản bạn đã lấy từ Kho chung.'}
        </p>
      )}
    </ShareDialog>
  );
}
