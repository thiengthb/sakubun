import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';

/**
 * A whole page that only reports a state (an error, a missing page, a broken link): one icon, a
 * title, at most one short line, then the way out, centred in the window. Empty lists inside a page
 * use EmptyState instead. The icon is sized here, so callers pass the icon type only.
 */
const TONE = {
  alert: 'bg-alert-wash text-alert',
  warn: 'bg-warn-wash text-warn',
  muted: 'bg-muted text-muted-foreground',
} as const;

export function PageState({
  icon: Icon,
  tone = 'muted',
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONE;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full flex-col py-4">
      <MobileTopBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-2xl [&_svg]:size-8',
            TONE[tone],
          )}
        >
          <Icon aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
        {children}
      </div>
    </div>
  );
}
