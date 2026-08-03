import { Inbox, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon shown in the muted circle at the top. Defaults to `Inbox` (the "nothing here yet" mark used
   *  on the dashboard). Pass `SearchX` for a "no match" (filtered-to-empty) state, or `null` for a
   *  compact in-card empty with no icon. */
  icon?: LucideIcon | null;
  /** Headline. Optional when `children` carries the copy instead. */
  title?: string;
  description?: ReactNode;
  /** Suggested action (e.g. a create/import button), centred below the copy. */
  action?: ReactNode;
  className?: string;
  /**
   * Free-form body for copy too rich for `title`/`description` (inline `<code>`, `<em>`). Rendered as
   * a centred muted paragraph. Prefer `title`/`description`/`action` for new call sites.
   */
  children?: ReactNode;
}

/**
 * THE shared empty state — one look for every "nothing here" spot so the app reads as one system
 * (2026-07-24: unified all empties through this). A dashed frame, a muted icon in a soft circle, an
 * optional headline + description, and an optional action. The default padding is generous (page-level
 * empties); a small in-card empty can shrink it via `className` (e.g. `py-8`) — tailwind-merge lets the
 * override win.
 *
 * Two icon conventions across the app: `Inbox` (default) = no data yet; `SearchX` = data exists but the
 * current filter/search matched nothing (keep the toolbar so the user can clear it). A page with NO data
 * hides its toolbar entirely and shows only this — the resources "Ngữ pháp" tab is the reference.
 *
 * VENDORED from `ui-kit/registry/thiengthb/empty-state.tsx` — keep in sync with the canonical version
 * (see `nuc-platform/08-SHARED-ASSETS.md`); the local prominent-icon restyle should be propagated back.
 */
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
