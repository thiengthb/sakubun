'use client';

import { createContext, useContext } from 'react';

/**
 * Id of the nearest <Field>'s visible label, so a control that does NOT render its own DOM node can
 * still be named by it.
 *
 * Needed because `Field` cannot simply clone its child with `aria-labelledby`: the child is usually a
 * Radix `Select` ROOT, which is a context provider and renders nothing, so the prop is dropped before
 * it can reach the actual <button>. Verified against the rendered HTML on 2026-07-20 — cloning alone
 * produced 0 of 4 named triggers.
 *
 * Lives in its own module so the vendored `components/ui/*` primitives can read it without importing
 * an app component (which would invert the dependency and make the copy-in harder to refresh).
 */
export const FieldLabelContext = createContext<string | undefined>(undefined);

/** The nearest Field label's id, or undefined when the control is not inside a Field. */
export function useFieldLabelId(): string | undefined {
  return useContext(FieldLabelContext);
}
