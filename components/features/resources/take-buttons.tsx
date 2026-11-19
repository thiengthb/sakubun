'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useServerAction } from '@/components/common/use-server-action';
import { Button } from '@/components/ui/button';
import { takeLevelAction, takeWordAction } from '@/app/resources/level/actions';
import { SET_SIZE } from '@/lib/library/level-sets';
import { UNIT, type LevelContext, type TakeScope } from '@/lib/library/level-screen';

// Taking words in place on Kho's level screens (U4d, docs/plans/2026-11-14-u4-kho.md). The page
// refreshes from the server once the words are in, so counts and marks change with it.

const message = (r: { message: string }) => r.message;

/**
 * A button that takes a set's missing words, or the level's when scope.set is null. More than a
 * set's worth asks first: N1 lacks up to 3,070 words, and Ôn nhanh brings them a few a day.
 */
export function TakeLevelTrigger({
  ctx,
  scope,
  className,
  children,
}: {
  ctx: Pick<LevelContext, 'level' | 'kind'>;
  scope: TakeScope;
  className?: string;
  children: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const take = useServerAction(takeLevelAction, {
    success: message,
    onSuccess: () => setAsking(false),
  });
  const run = () => take.run(ctx.level, ctx.kind, scope.set);
  const unit = UNIT[ctx.kind];
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={take.isPending}
        aria-busy={take.isPending}
        onClick={() => (scope.set === null && scope.count > SET_SIZE ? setAsking(true) : run())}
      >
        {children}
      </button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Lấy ${scope.count} ${unit} còn thiếu của ${ctx.level}?`}
        description={`Các ${unit} vào kho của bạn như mục mới; Ôn nhanh đưa ra dần theo hạn mức mỗi ngày, không dồn một lúc.`}
        confirmLabel={`Lấy ${scope.count} ${unit}`}
        confirmVariant="default"
        pending={take.isPending}
        onConfirm={run}
      />
    </>
  );
}

/** "Học" on a word not in the learner's Kho yet: it joins as a new item. */
export function TakeWordButton({
  entryId,
  expression,
  className,
}: {
  entryId: string;
  expression: string;
  className?: string;
}) {
  const take = useServerAction(takeWordAction, { success: message });
  return (
    <Button
      className={className}
      disabled={take.isPending}
      aria-label={`Học ${expression}`}
      onClick={() => take.run(entryId)}
    >
      {take.isPending && <Loader2 className="animate-spin" />}
      Học
    </Button>
  );
}
