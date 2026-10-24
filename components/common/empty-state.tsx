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
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 px-6 py-16 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <div className="space-y-1">
        {title && <p className="text-sm font-medium">{title}</p>}
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
        {children && (
          <div className="mx-auto max-w-sm text-sm text-muted-foreground">{children}</div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
