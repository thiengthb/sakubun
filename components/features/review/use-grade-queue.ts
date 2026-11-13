'use client';

import { useEffect, useRef, useState } from 'react';
import { createSender, type SenderIo } from '@/lib/session/grade-sender';

// U2e: the session moves to the next card the moment a grade is given, and the grade goes to the
// server behind it (lib/session/grade-sender.ts).

export interface GradeQueue<P> {
  /** Queue a grade; it is sent behind the session. */
  enqueue: (payload: P) => void;
  /** Grades not yet in, counted only once a send has failed (a grade in flight is not news). */
  unsaved: number;
  /** Every grade given so far is in. */
  saved: boolean;
}

export function useGradeQueue<P extends object>(
  send: SenderIo<P>['send'],
  onRefused: SenderIo<P>['refused'],
): GradeQueue<P> {
  const [state, setState] = useState({ left: 0, stalled: false });
  const io = useRef<SenderIo<P>>({
    send,
    refused: onRefused,
    // `stalled` holds until a send succeeds: a grade queued behind a failed one is unsaved too.
    changed: (left, stalled) =>
      setState((s) => ({ left, stalled: left > 0 && (stalled || (s.stalled && left >= s.left)) })),
  });
  useEffect(() => {
    io.current.send = send;
    io.current.refused = onRefused;
  });
  // Made on the first grade, in an event handler: it holds the queue for the life of the page.
  const sender = useRef<ReturnType<typeof createSender<P>> | null>(null);

  useEffect(() => {
    const online = () => sender.current?.retryNow();
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      sender.current?.stop();
    };
  }, []);

  return {
    enqueue: (payload) => {
      sender.current ??= createSender(io);
      sender.current.enqueue(payload);
    },
    unsaved: state.stalled ? state.left : 0,
    saved: state.left === 0,
  };
}
