import type { ActionResult } from '@/lib/core/action-result';

// U2e (docs/plans/2026-11-13-u2-study-session.md): the queue behind a study session. A grade goes
// to the server one at a time and in order. A grade the network drops stays here and is sent again,
// with the same id, so the server records it once (ReviewLog.clientId). A grade the server refuses
// (the card was graded elsewhere) is dropped and said once. No React here: the hook in
// components/features/review/use-grade-queue.ts holds one of these for the life of the page.

/** Wait before the n-th retry of a grade the network dropped: 1s, 2s, 4s, 8s, then every 15s. */
export function retryDelay(attempt: number): number {
  return Math.min(15_000, 1000 * 2 ** attempt);
}

function newId(): string {
  // randomUUID needs a secure context; a LAN address over plain http has none.
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface SenderState {
  /** Grades not yet on the server, the held one included. */
  left: number;
  /** The last send failed for want of an answer; cleared by the next one that gets through. */
  stalled: boolean;
  /** A grade is held back for undo (U2f). */
  held: boolean;
}

export interface SenderIo<P> {
  send: (payload: P & { clientId: string }) => Promise<ActionResult<unknown>>;
  refused: (error: string) => void;
  changed: (state: SenderState) => void;
}

/** A grade as it goes to the server, with the id it keeps across retries. */
export type Sent<P> = P & { clientId: string };

/**
 * The queue itself, outside React: it outlives renders, and the page too, so a grade still waiting
 * when the learner leaves the session in-app keeps trying. It calls `ref.current` as it is when it
 * runs.
 *
 * U2f: a grade given with `hold` waits here, not sent, until the next grade, `release()` or the
 * page going away, so `undo()` can take it back without the server ever seeing it.
 */
export function createSender<P extends object>(ref: { current: SenderIo<P> }) {
  const queue: { id: string; payload: P }[] = [];
  let held: { id: string; payload: P } | null = null;
  let busy = false;
  let stalled = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const changed = () =>
    ref.current.changed({ left: queue.length + (held ? 1 : 0), stalled, held: held !== null });

  async function pump(): Promise<void> {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    try {
      while (queue.length > 0) {
        const head = queue[0];
        let result: ActionResult<unknown>;
        try {
          result = await ref.current.send({ ...head.payload, clientId: head.id });
        } catch {
          // The request never got an answer: keep the grade and try again later.
          stalled = true;
          changed();
          timer = setTimeout(() => void pump(), retryDelay(attempt++));
          return;
        }
        attempt = 0;
        stalled = false;
        queue.shift();
        changed();
        if (!result.ok) ref.current.refused(result.error);
      }
    } finally {
      busy = false;
    }
  }

  function release() {
    if (!held) return;
    queue.push(held);
    held = null;
    changed();
    void pump();
  }

  return {
    enqueue(payload: P, options: { hold?: boolean } = {}) {
      release();
      const grade = { id: newId(), payload };
      if (options.hold) held = grade;
      else queue.push(grade);
      changed();
      void pump();
    },
    /** Take back the held grade, unsent; null if there is none. */
    undo(): P | null {
      if (!held) return null;
      const { payload } = held;
      held = null;
      changed();
      return payload;
    },
    /** Send the held grade now: the session is over, or the learner is leaving it. */
    release,
    /** Every grade not yet known to be in, for a last send as the page goes away. */
    unsent(): Sent<P>[] {
      return [...queue, ...(held ? [held] : [])].map((g) => ({ ...g.payload, clientId: g.id }));
    },
    /** Back online: try at once rather than wait out the delay. */
    retryNow() {
      attempt = 0;
      void pump();
    },
  };
}
