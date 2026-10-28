import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';

/** A list page's create action: plus, the word "Thêm", and a page of its own (no dialog). */
export function AddButton({ href, className }: { href: string; className?: string }) {
  return (
    <ExpandingIconButton asChild icon={Plus} label="Thêm" variant="default" className={className}>
      <Link href={href} />
    </ExpandingIconButton>
  );
}
