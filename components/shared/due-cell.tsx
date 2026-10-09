import { DueTime } from '@/components/shared/relative-time';

export function DueCell({ srs }: { srs: { state: number; due: string | Date } | null }) {
  if (!srs || srs.state === 0) return <span className="text-muted-foreground">—</span>;
  return <DueTime value={srs.due} className="text-muted-foreground" />;
}
