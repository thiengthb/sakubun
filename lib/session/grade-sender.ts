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

export interface SenderIo<P> {
  send: (payload: P & { clientId: string }) => Promise<ActionResult<unknown>>;
  refused: (error: string) => void;
  changed: (left: number, stalled: boolean) => void;
}

/** The queue itself, outside React: it outlives renders and calls `io` as it is when it runs. */
export function createSender<P extends object>(ref: { current: SenderIo<P> }) {
  const queue: { id: string; payload: P }[] = [];
  let busy = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
          ref.current.changed(queue.length, true);
          timer = setTimeout(() => void pump(), retryDelay(attempt++));
          return;
        }
        attempt = 0;
        queue.shift();
        ref.current.changed(queue.length, false);
        if (!result.ok) ref.current.refused(result.error);
      }
    } finally {
      busy = false;
    }
  }

  return {
    enqueue(payload: P) {
      queue.push({ id: newId(), payload });
      ref.current.changed(queue.length, false);
      void pump();
    },
    /** Back online: try at once rather than wait out the delay. */
    retryNow() {
      attempt = 0;
      void pump();
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
