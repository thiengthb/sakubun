import { Inbox, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';

interface EmptyStateProps {
  icon?: LucideIcon | null;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  // docs/ui-standard.md: a dashed box, left-aligned and as tall as its content, never a centred
  // block that leaves the page empty.
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 border-dashed border-border px-4 py-5 md:px-6',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-sm font-bold">{title}</p>}
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
        {children && <div className="max-w-prose text-sm text-muted-foreground">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
