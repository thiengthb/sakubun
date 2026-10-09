import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

function initials(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || null;
}

const SIZES = {
  xs: 'size-5 text-[0.625rem]',
  sm: 'size-7 text-xs',
  md: 'size-8 text-xs',
} as const;

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
