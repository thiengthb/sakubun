'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Explain } from '@/components/common/explain';

import { cn } from '@/lib/core/utils';

const CLEARABLE_TYPES = new Set<string | undefined>([
  undefined,
  'text',
  'search',
  'email',
  'url',
  'tel',
]);

function clearNatively(el: HTMLInputElement): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, '');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

function Input({
  className,
  wrapperClassName,
  clearable,
  type,
  ref,
  onChange,
  ...props
}: React.ComponentProps<'input'> & {
  clearable?: boolean;
  wrapperClassName?: string;
}) {
  const innerRef = React.useRef<HTMLInputElement>(null);
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
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          showClear && 'pr-7',
          className,
        )}
        {...props}
      />
      {showClear && (
        <Explain text="Xóa toàn bộ nội dung đang gõ trong ô này.">
          <button
            type="button"
            aria-label="Xóa nội dung"
            onClick={() => {
              if (innerRef.current) clearNatively(innerRef.current);
            }}
            className="absolute top-1/2 right-1 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </Explain>
      )}
    </div>
  );
}

export { Input };
