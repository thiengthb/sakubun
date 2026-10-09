'use client';

import { createContext, useContext } from 'react';

export const FieldLabelContext = createContext<string | undefined>(undefined);

export function useFieldLabelId(): string | undefined {
  return useContext(FieldLabelContext);
}
