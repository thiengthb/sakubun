'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createSender,
  type SenderIo,
  type SenderState,
  type Sent,
} from '@/lib/session/grade-sender';
import { CLOSING_GRADES_MAX } from '@/lib/app/card-answer-schema';

// U2e: the session moves to the next card the moment a grade is given, and the grade goes to the
// server behind it (lib/session/grade-sender.ts). U2f: the last grade can be held back for undo.

/** Where the grades still on the device go as the page is closed or reloaded (sendBeacon). */
export const GRADE_BEACON_URL = '/api/review/answer';
/** The most grades one request to it may carry (closingGradesSchema). */
const BEACON_BATCH = CLOSING_GRADES_MAX;

export interface GradeQueue<P> {
  /** Queue a grade; it is sent behind the session. With `hold`, it waits for the next one (undo). */
  enqueue: (payload: P, options?: { hold?: boolean }) => void;
  /** Take back the held grade, unsent. */
  undo: () => P | null;
  /** Send the held grade now. */
  release: () => void;
  /** A grade is held and can be taken back. */
  canUndo: boolean;
  /** Grades the network dropped and that wait to go again; 0 while nothing failed. */
  unsaved: number;
  /** Every grade given so far is in. */
  saved: boolean;
}

export function useGradeQueue<P extends object>(
  send: SenderIo<P>['send'],
  onRefused: SenderIo<P>['refused'],
): GradeQueue<P> {
  const [state, setState] = useState<SenderState>({ left: 0, stalled: false, held: false });
  const io = useRef<SenderIo<P>>({ send, refused: onRefused, changed: setState });
  useEffect(() => {
    io.current.send = send;
    io.current.refused = onRefused;
  });
  // Made on the first grade, in an event handler. It is not stopped when the session unmounts: a
  // grade still waiting when the learner leaves in-app (Dừng ôn, the sidebar) keeps trying.
  const sender = useRef<ReturnType<typeof createSender<P>> | null>(null);

  useEffect(() => {
    const online = () => sender.current?.retryNow();
    // Closing or reloading the page ends this JavaScript: hand what is left to the browser, which
    // sends it after the page is gone. A grade that also got through the normal way is recorded
    // once (its clientId). The held grade goes too, so it can no longer be taken back.
    const leaving = () => {
      const left: Sent<P>[] = sender.current?.unsent() ?? [];
      if (left.length === 0) return;
      // The route takes at most BEACON_BATCH grades a request: a long offline session goes in
      // several, in order. The held grade is let go only if the browser queued every one.
      let queued = true;
      for (let i = 0; i < left.length; i += BEACON_BATCH) {
        const body = new Blob([JSON.stringify(left.slice(i, i + BEACON_BATCH))], {
          type: 'application/json',
        });
        queued = (navigator.sendBeacon?.(GRADE_BEACON_URL, body) ?? false) && queued;
      }
      if (queued) sender.current?.release();
    };
    window.addEventListener('online', online);
    window.addEventListener('pagehide', leaving);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', leaving);
      // Leaving the session in-app: nothing to undo any more, so the held grade goes now.
      sender.current?.release();
    };
  }, []);

  // Stable across renders, so a page can name them in an effect's dependencies.
  const [actions] = useState(() => ({
    enqueue: (payload: P, options?: { hold?: boolean }) =>
      (sender.current ??= createSender(io)).enqueue(payload, options),
    undo: () => sender.current?.undo() ?? null,
    release: () => sender.current?.release(),
  }));
  return {
    ...actions,
    canUndo: state.held,
    unsaved: state.stalled ? state.left - (state.held ? 1 : 0) : 0,
    saved: state.left === 0,
  };
}
