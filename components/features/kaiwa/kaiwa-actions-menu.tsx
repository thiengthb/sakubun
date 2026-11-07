'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AArrowDown,
  AArrowUp,
  Drama,
  Globe,
  Keyboard,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { ScriptShareButton } from '@/components/common/share-to-library';
import { ShortcutsList, type Shortcut } from '@/components/common/shortcuts-help';
import { useKaiwaTextSize } from '@/components/features/kaiwa/use-kaiwa-text-size';
import type { ScriptShareStatus } from '@/lib/library/scripts';

async function copyCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    toast.success('Đã chép, dán vào Claude', { description: command });
  } catch {
    toast.error('Không chép được vào clipboard', { description: command });
  }
}

// A script's actions behind one menu (thien, 2026-11-07): Sửa, the two phrases to paste into
// Claude, the chat's text size, Chia sẻ and the shortcuts. What the learner presses while practising (Tôi là, Nghe cả bài,
// Ẩn nghĩa, Che câu của tôi) stays in the chat's toolbar.
export function KaiwaActionsMenu({
  scriptId,
  share,
  onEdit,
  editCommand,
  roleplay,
  voicesHref,
  shortcuts,
}: {
  scriptId: string;
  share: ScriptShareStatus;
  onEdit: () => void;
  editCommand: string;
  /** "Nhập vai với AI": only with two parts or more. */
  roleplay: string | null;
  /** "Giọng từng vai" (Kaiwa c): its page, only when the script has a part. */
  voicesHref: string | null;
  shortcuts: readonly Shortcut[];
}) {
  const [dialog, setDialog] = useState<'share' | 'keys' | null>(null);
  const textSize = useKaiwaTextSize();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ExpandingIconButton icon={MoreHorizontal} label="Thao tác" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copyCommand(editCommand)}>
            <Sparkles aria-hidden />
            Sửa với AI
          </DropdownMenuItem>
          {roleplay && (
            <DropdownMenuItem onSelect={() => copyCommand(roleplay)}>
              <Drama aria-hidden />
              Nhập vai với AI
            </DropdownMenuItem>
          )}
          {voicesHref && (
            <DropdownMenuItem asChild>
              <Link href={voicesHref}>
                <Volume2 aria-hidden />
                Giọng từng vai
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {/* The menu stays open, so the learner sees the chat grow step by step. */}
          <DropdownMenuItem
            disabled={!textSize.canGrow}
            onSelect={(e) => {
              e.preventDefault();
              textSize.grow();
            }}
          >
            <AArrowUp aria-hidden />
            Chữ to hơn
            <span className="ml-auto text-xs text-muted-foreground">{textSize.label}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!textSize.canShrink}
            onSelect={(e) => {
              e.preventDefault();
              textSize.shrink();
            }}
          >
            <AArrowDown aria-hidden />
            Chữ nhỏ hơn
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog('share')}>
            <Globe aria-hidden className={share.shared ? 'text-accent-brand' : undefined} />
            {share.shared ? 'Đang chia sẻ' : 'Chia sẻ'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('keys')} className="max-md:hidden">
            <Keyboard aria-hidden />
            Phím tắt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ScriptShareButton
        scriptId={scriptId}
        status={share}
        open={dialog === 'share'}
        onOpenChange={(open) => setDialog(open ? 'share' : null)}
      />
      <Dialog open={dialog === 'keys'} onOpenChange={(open) => setDialog(open ? 'keys' : null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Phím tắt</DialogTitle>
            <DialogDescription>Trên trang một kịch bản.</DialogDescription>
          </DialogHeader>
          <ShortcutsList shortcuts={shortcuts} />
        </DialogContent>
      </Dialog>
    </>
  );
}
