import { describe, expect, it } from 'vitest';
import { showConnectHint } from './connect-hint';

describe('showConnectHint', () => {
  it('chỉ hiện khi chưa kết nối AI và chưa ôn lần nào', () => {
    expect(showConnectHint({ connected: false, reviewed: false })).toBe(true);
    expect(showConnectHint({ connected: true, reviewed: false })).toBe(false);
    // Ôn nhanh on the web counts: someone who reviews without AI has found the app.
    expect(showConnectHint({ connected: false, reviewed: true })).toBe(false);
    expect(showConnectHint({ connected: true, reviewed: true })).toBe(false);
  });
});
