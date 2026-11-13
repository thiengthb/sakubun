import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionResult } from '@/lib/core/action-result';
import { createSender, retryDelay, type SenderIo } from '@/lib/session/grade-sender';

type Grade = { itemId: string };

function setup(replies: (() => Promise<ActionResult<unknown>>)[]) {
  const sent: (Grade & { clientId: string })[] = [];
  const changes: [number, boolean][] = [];
  const refused: string[] = [];
  const io: SenderIo<Grade> = {
    send: (payload) => {
      sent.push(payload);
      const reply = replies.shift();
      return reply ? reply() : Promise.resolve({ ok: true, data: null });
    },
    refused: (e) => refused.push(e),
    changed: (left, stalled) => changes.push([left, stalled]),
  };
  return { sender: createSender({ current: io }), sent, changes, refused };
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('retryDelay', () => {
  it('doubles from one second and stops at fifteen', () => {
    expect([0, 1, 2, 3, 4, 9].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });
});

describe('createSender', () => {
  it('sends grades one at a time, in the order given', async () => {
    let release!: () => void;
    const slow = () =>
      new Promise<ActionResult<unknown>>((r) => (release = () => r({ ok: true, data: null })));
    const { sender, sent, changes } = setup([slow]);
    sender.enqueue({ itemId: 'a' });
    sender.enqueue({ itemId: 'b' });
    await flush();
    expect(sent.map((g) => g.itemId)).toEqual(['a']);
    release();
    await flush();
    expect(sent.map((g) => g.itemId)).toEqual(['a', 'b']);
    expect(changes.at(-1)).toEqual([0, false]);
  });

  it('keeps a grade the network dropped and sends it again with the same id', async () => {
    const { sender, sent, changes } = setup([offline, offline]);
    sender.enqueue({ itemId: 'a' });
    await flush();
    expect(changes.at(-1)).toEqual([1, true]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((g) => g.clientId)).size).toBe(1);
    expect(changes.at(-1)).toEqual([0, false]);
  });

  it('gives each grade its own id', async () => {
    const { sender, sent } = setup([]);
    sender.enqueue({ itemId: 'a' });
    sender.enqueue({ itemId: 'b' });
    await flush();
    expect(sent[0].clientId).not.toBe(sent[1].clientId);
  });

  it('tries at once when told the network is back', async () => {
    const { sender, sent } = setup([offline]);
    sender.enqueue({ itemId: 'a' });
    await flush();
    sender.retryNow();
    await flush();
    expect(sent).toHaveLength(2);
    // The scheduled retry was replaced, not added to.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent).toHaveLength(2);
  });

  it('drops a grade the server refused, says why, and goes on', async () => {
    const { sender, sent, refused } = setup([
      () => Promise.resolve({ ok: false, error: 'Thẻ này vừa được chấm ở nơi khác.' }),
    ]);
    sender.enqueue({ itemId: 'a' });
    sender.enqueue({ itemId: 'b' });
    await flush();
    expect(refused).toEqual(['Thẻ này vừa được chấm ở nơi khác.']);
    expect(sent.map((g) => g.itemId)).toEqual(['a', 'b']);
  });
});
