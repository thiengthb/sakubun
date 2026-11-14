import { cn } from '@/lib/core/utils';

/**
 * One answer of a cloze (docs/plans/2026-11-13-u2-study-session.md, U2b): a Duolingo tile with a
 * thick bottom edge that a press sinks into (the margin takes the 2px it loses, so nothing below
 * moves), its number for the keyboard at the left, the word in the middle. Once answered, the right
 * answer turns green, a wrong pick red, and the rest step back.
 */
export function AnswerOption({
  index,
  label,
  answered,
  isAnswer,
  isPicked,
  onPick,
}: {
  /** 0-based; shown as 1-4, the key that picks it. */
  index: number;
  label: string;
  answered: boolean;
  isAnswer: boolean;
  isPicked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={answered}
      onClick={onPick}
      className={cn(
        'relative flex min-h-16 items-center justify-center rounded-xl border-2 border-b-4 px-12 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        !answered && 'border-control-edge bg-card hover:bg-muted active:mt-0.5 active:border-b-2',
        answered && isAnswer && 'border-ok bg-ok-wash text-ok',
        answered && isPicked && !isAnswer && 'border-destructive bg-alert-wash text-destructive',
        answered && !isAnswer && !isPicked && 'border-control-edge bg-card opacity-50',
      )}
    >
      <span className="absolute left-3 flex size-7 items-center justify-center rounded-md border-2 border-current/20 text-xs font-semibold opacity-80">
        {index + 1}
      </span>
      <span lang="ja" className="text-lg font-semibold">
        {label}
      </span>
    </button>
  );
}
