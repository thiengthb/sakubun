import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { IconTile } from '@/components/common/icon-tile';
import { cn } from '@/lib/core/utils';

// A band at the top of a page that says the thing on it is in a state that changes what the page
// means: a suspended item (thien, item detail round 2: it must show at a glance). Dashed, not
// raised, because it is a state to notice, not a button; the action sits at its end.
export function StateNotice({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-lg border-2 border-dashed border-control-edge bg-muted/60 px-4 py-3',
        className,
      )}
    >
      <IconTile icon={icon} tone="muted" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {children && <p className="text-xs text-muted-foreground">{children}</p>}
      </div>
      {action}
    </div>
  );
}
