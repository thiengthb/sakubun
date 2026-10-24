import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/utils';

// The ONE way a section announces itself. Before this existed the dashboard defined its own
// SectionHeader inside app/page.tsx (icon tile + text-base) while Settings had a second, unrelated
// one in SettingsGroup (bare text-sm) — so the two biggest pages disagreed about what a section
// title looks like, and neither could be reused.
//
// `level` is the only knob: "page" for the top-level bands of a long page, "group" for a block
// inside one. Everything else is composition — pass an icon or don't, pass an action or don't.
const LEVEL = {
  page: { gap: 'gap-3', title: 'text-title3', wrapper: 'pt-2' },
  group: { gap: 'gap-2', title: 'text-body', wrapper: '' },
} as const;

export function SectionHeading({
  title,
  hint,
  icon: Icon,
  level = 'group',
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  level?: keyof typeof LEVEL;
  action?: ReactNode;
  className?: string;
}) {
  const style = LEVEL[level];
  return (
    <div className={cn('flex items-start', style.gap, style.wrapper, className)}>
      {Icon && (
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand"
        >
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0 space-y-0.5">
        <h2 className={cn('font-heading font-semibold', style.title)}>{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
