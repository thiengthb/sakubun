import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The theme's type scale (app/globals.css @theme: --text-body, --text-subhead, ...). Stock
// tailwind-merge does not know these names, so it read `text-body` as a COLOUR: cn('text-body
// text-muted-foreground') dropped the size, and cn('text-sm', 'text-subhead') kept both.
export const TYPE_SCALE = [
  'large-title',
  'title1',
  'title2',
  'title3',
  'body',
  'callout',
  'subhead',
  'footnote',
  'caption1',
  'caption2',
] as const;

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: [...TYPE_SCALE] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
