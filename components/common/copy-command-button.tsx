'use client';

import { useState } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { cn } from '@/lib/core/utils';

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
  command: string;
  label: string;
  icon?: LucideIcon;
  showCopiedText?: boolean;
  toastDescription?: 'command' | 'none';
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  expandOnHover?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const describe = toastDescription === 'command' ? { description: command } : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success('Đã chép — dán vào client MCP', describe);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không chép được vào clipboard', describe);
    }
  };

  const Leading = copied ? Check : (Icon ?? Copy);

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
