'use client';

import { useEffect, useSyncExternalStore } from 'react';

// UI v2, phase 2 (docs/plans/2026-11-13-u2-study-session.md): a study session has the screen to
// itself. While <StudyFocus /> is on the page the app's way-finding steps aside: the phone's tab bar
// and the laptop's sidebar. The session's own X leads out.

let holders = 0;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** True while a study session holds the screen. */
export function useStudyFocus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => holders > 0,
    () => false,
  );
}

/** Rendered by a study session for as long as it runs. */
export function StudyFocus() {
  useEffect(() => {
    holders++;
    listeners.forEach((l) => l());
    return () => {
      holders--;
      listeners.forEach((l) => l());
    };
  }, []);
  return null;
}
