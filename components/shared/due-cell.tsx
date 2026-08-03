import { DueTime } from '@/components/shared/relative-time';

/**
 * The "Đến hạn" cell shared by the grammar + vocab resource tables: a dash for a not-yet-scheduled
 * (state 0 / null) row, otherwise the relative due time with the exact moment on hover ({@link DueTime}).
 * Takes the structural SRS shape so both `ItemRow['srs']` and `VocabRow['srs']` fit.
 */
export function DueCell({ srs }: { srs: { state: number; due: string | Date } | null }) {
  if (!srs || srs.state === 0) return <span className="text-muted-foreground">—</span>;
  return <DueTime value={srs.due} className="text-muted-foreground" />;
}
