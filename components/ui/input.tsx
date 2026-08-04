'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Explain } from '@/components/shared/explain';

import { cn } from '@/lib/utils';

/**
 * Types that get the CLEAR (×) affordance by default — free TEXT entry, where wiping the box by hand is
 * the annoying part. A number spinner, a password field (the browser adds its own reveal control) and
 * the native date/color pickers already carry controls of their own, so they opt out. Pass `clearable`
 * explicitly to force either way.
 */
const CLEARABLE_TYPES = new Set<string | undefined>([
  undefined,
  'text',
  'search',
  'email',
  'url',
  'tel',
]);

/**
 * Clear the input the way a USER would, so every call site works with no extra prop: write '' through
 * the NATIVE value setter (bypassing React's instance-level value tracker) and dispatch a real `input`
 * event. React then fires `onChange` exactly as if the field had been emptied by hand — which keeps a
 * CONTROLLED input's owner state in sync AND an UNCONTROLLED one's DOM value, with one code path.
 */
function clearNatively(el: HTMLInputElement): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, '');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

/**
 * The ONE text input. Beyond the shadcn base it owns the **clear (×) button**: whenever a text-ish input
 * has content, an × sits at its right edge and empties it in one click (user ask 2026-07-25) — so no
 * screen hand-rolls its own clear control.
 *
 * `className` still styles the INPUT (padding, height, font). Width normally comes from the parent (the
 * input is `w-full`); when a call site needs to size the control itself inside a flex row, pass
 * `wrapperClassName` (e.g. `min-w-0 flex-1`) so the × stays anchored to the visible right edge.
 */
function Input({
  className,
  wrapperClassName,
  clearable,
  type,
  ref,
  onChange,
  ...props
}: React.ComponentProps<'input'> & {
  /** Force the × on/off. Default: on for text-ish types (see CLEARABLE_TYPES). */
  clearable?: boolean;
  /** Classes for the relative wrapper — use for width/flex sizing of the whole control. */
  wrapperClassName?: string;
}) {
  const innerRef = React.useRef<HTMLInputElement>(null);
  // An uncontrolled input reports its content only through the DOM, so track it locally; a controlled
  // one (a `value` prop) is authoritative on its own.
  const controlled = props.value != null;
  const [domValue, setDomValue] = React.useState(() => String(props.defaultValue ?? ''));
  const filled = (controlled ? String(props.value) : domValue).length > 0;
  const showClear =
    (clearable ?? CLEARABLE_TYPES.has(type)) && filled && !props.disabled && !props.readOnly;

  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type={type}
        data-slot="input"
        onChange={(e) => {
          if (!controlled) setDomValue(e.target.value);
          onChange?.(e);
        }}
        className={cn(
          // h-9 + rounded-xl + px-3.5: a field is a WELL, not a hairline box — `bg-card` gives it a
          // surface of its own so it reads as inset on the cream page and as a field inside a white card.
          'h-9 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          // Only while the × is visible — right padding does not move left-aligned text, so nothing
          // jumps when it appears on the first keystroke.
          showClear && 'pr-9',
          className,
        )}
        {...props}
      />
      {showClear && (
        <Explain text="Xóa toàn bộ nội dung đang gõ trong ô này.">
          <button
            type="button"
            aria-label="Xóa nội dung"
            // A form input's × must never submit the form (type=button) and must not steal the label
            // click; it re-focuses the field after clearing so typing can continue.
            onClick={() => {
              if (innerRef.current) clearNatively(innerRef.current);
            }}
            className="absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </Explain>
      )}
    </div>
  );
}

export { Input };
