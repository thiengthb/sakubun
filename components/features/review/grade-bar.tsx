import { Button } from '@/components/ui/button';
import { humanizeUntil } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import type { RatingValue } from '@/lib/srs/srs';

// "10 phút", "8 ngày": the wait on a grade button, without "nữa" and never "dưới 1 phút".
const shortUntil = (due: Date) =>
  humanizeUntil(due).replace(/ nữa$/, '').replace('dưới 1 phút', '1 phút');

// The four FSRS buttons of a flip card (decision 0005), each with when the item comes back.
export const GRADES: { rating: RatingValue; label: string; tone?: string }[] = [
  { rating: 1, label: 'Quên', tone: 'text-destructive' },
  { rating: 2, label: 'Khó' },
  { rating: 3, label: 'Nhớ' },
  { rating: 4, label: 'Dễ', tone: 'text-ok' },
];

/**
 * U2c (docs/plans/2026-11-13-u2-study-session.md): the grades of a flipped card, each with when the
 * item comes back. It takes the place of the four answers: on a phone at the foot of the screen,
 * two columns with the misses (Quên, Khó) on the left and the hits (Nhớ, Dễ) on the right, so a
 * thumb finds each side without reading; on a laptop one row of four right under the card. The
 * suggested grade (Nhớ, or the write pad's) is the filled one and also answers to Enter.
 */
export function GradeBar({
  dueBy,
  good,
  disabled,
  onGrade,
}: {
  dueBy: Record<RatingValue, Date>;
  good: RatingValue;
  disabled: boolean;
  onGrade: (rating: RatingValue) => void;
}) {
  return (
    <div
      className="grid w-full grid-flow-col grid-cols-2 grid-rows-2 gap-2 sm:grid-flow-row sm:grid-cols-4 sm:grid-rows-1"
      role="group"
      aria-label="Chấm thẻ"
    >
      {GRADES.map(({ rating, label, tone }) => (
        <Button
          key={rating}
          size="lg"
          variant={rating === good ? 'default' : 'outline'}
          className={cn(rating !== good && tone)}
          disabled={disabled}
          aria-keyshortcuts={rating === good ? `${rating} Enter` : String(rating)}
          onClick={() => onGrade(rating)}
        >
          {label}
          <span className="text-xs opacity-75">{shortUntil(dueBy[rating])}</span>
        </Button>
      ))}
    </div>
  );
}
