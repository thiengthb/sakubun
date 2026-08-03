'use client';

import { useState } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { cn } from '@/lib/utils';

/**
 * Copies a ready-made instruction to the clipboard for the user to paste into Claude Desktop.
 *
 * Why this shape: the app cannot talk to Claude Desktop — the MCP connection runs the other way, with
 * Claude as the client. So a page cannot "start a session" itself. What it CAN do is remove the part
 * the learner has to compose from memory: the exact pattern name, the exact field that is missing.
 * That turns a detail page from a dead end into the start of the next action, without inventing a
 * second control path into the practice loop (and without touching invariant #1 — nothing is written).
 */
export function CopyCommandButton({
  command,
  label,
  icon: Icon,
  variant = 'outline',
  size = 'sm',
  expandOnHover = false,
  showCopiedText = true,
  toastDescription = 'command',
  className,
}: {
  /** The exact text pasted into Claude Desktop. */
  command: string;
  label: string;
  icon?: LucideIcon;
  /** Keep the visible label after copying. `false` = icon-only button (a code block's corner action). */
  showCopiedText?: boolean;
  /**
   * What the toast shows under its headline. `'command'` (default) echoes the copied text — right for a
   * one-line prompt. `'none'` omits it: a multi-line config block would fill the screen.
   */
  toastDescription?: 'command' | 'none';
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  /** Render as a collapsed icon button that expands its label on hover/focus — matches the resources
   * toolbar actions (Cột / Bộ lọc / Nhập). */
  expandOnHover?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const describe = toastDescription === 'command' ? { description: command } : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success('Đã chép — dán vào Claude Desktop', describe);
      // Revert the confirmation so the button does not look permanently "done".
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (permissions, insecure context). Show the text so the action
      // is still completable by hand rather than failing silently.
      toast.error('Không chép được vào clipboard', describe);
    }
  };

  const Leading = copied ? Check : (Icon ?? Copy);

  // Collapsed toolbar-style action (icon at rest, label slides in on hover/focus) — reuses the shared
  // ExpandingIconButton so the detail-page actions match the resources toolbar exactly.
  if (expandOnHover) {
    return (
      <ExpandingIconButton
        icon={Leading}
        label={copied ? 'Đã chép' : label}
        onClick={copy}
        variant={variant}
        size={size}
        className={className}
      />
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(className)}
    >
      <Leading className={cn('size-4 shrink-0', copied && 'text-ok')} aria-hidden />
      {showCopiedText && (copied ? 'Đã chép' : label)}
    </Button>
  );
}
