import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { err, ok } from '@/lib/core/action-result';
import { RETRY_LABEL, toastResult } from '@/lib/core/action-toast';

describe('toastResult', () => {
  beforeEach(() => {
    toast.success.mockClear();
    toast.error.mockClear();
  });

  it('toasts success with a fixed or computed message', () => {
    expect(toastResult(ok(3), (n) => `Đã thêm ${n} mục`)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Đã thêm 3 mục');
  });

  it('offers "Thử lại" on a retryable failure and runs the retry when pressed', () => {
    const retry = vi.fn();
    expect(toastResult(err('Mất mạng', { retryable: true }), 'ok', retry)).toBe(false);
    const [message, opts] = toast.error.mock.calls[0];
    expect(message).toBe('Mất mạng');
    expect(opts.action.label).toBe(RETRY_LABEL);
    opts.action.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows no retry button when sending again would fail the same way', () => {
    toastResult(err('Tên trống', { field: 'name' }), 'ok', vi.fn());
    toastResult(err('Mất mạng', { retryable: true }), 'ok');
    expect(toast.error.mock.calls).toEqual([['Tên trống'], ['Mất mạng']]);
  });
});
