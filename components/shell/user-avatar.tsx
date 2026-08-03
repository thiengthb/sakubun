import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Two-letter initials from a display name (first + last), or null if none can be derived. */
function initials(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || null;
}

// The one avatar size scale — a circular badge whose glyph (initials / icon) scales with the box.
const SIZES = {
  xs: 'size-5 text-[0.625rem]',
  sm: 'size-7 text-xs',
  md: 'size-8 text-xs',
} as const;

/**
 * The circular identity avatar used everywhere a person is shown (sidebar footer + community feed
 * cards + comment threads): the account photo when present (e.g. from Google), else the name's
 * initials, else a generic user icon. Extracted from `sidebar-user` so every avatar is the SAME
 * shape/fallback ladder in one place (build the reusable thing once). Decorative by default —
 * the name is conveyed by adjacent text / a tooltip, so the badge itself is `aria-hidden`.
 */
export function UserAvatar({
  name,
  image,
  size = 'md',
  className,
}: {
  name: string;
  image?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const ini = initials(name);
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground',
        SIZES[size],
        className,
      )}
    >
      {image ? (
        // Account photo (e.g. Google). Plain img: a remote avatar, not a layout-critical asset.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : ini ? (
        ini
      ) : (
        <UserRound className="size-[55%]" aria-hidden />
      )}
    </span>
  );
}
