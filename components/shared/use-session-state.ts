'use client';

import { useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

/**
 * Drop-in `useState` that PERSISTS across navigation + reload within the browser-tab session
 * (sessionStorage), so a table's filters/sort/page/tab survive leaving the page and coming back via
 * the sidebar's bare links — the app's primary navigation, which a URL query on the address bar can't
 * preserve on its own (and per-keystroke URL sync would refetch server data). Key is namespaced by the
 * caller so sibling tables never collide. Values are JSON, so strings/numbers/small objects round-trip.
 *
 * Optional `urlKey`: ALSO mirror the value to the address bar (`?urlKey=…`) via `history.replaceState`
 * (no Next navigation → no server refetch), and seed from the URL on a fresh load so a SHARED LINK
 * restores that filter. Use it for the shareable filter fields (search / level / state / tab); leave it
 * off for ephemeral prefs (sort / page / page-size). URL serialization is raw for string values,
 * JSON for the rest.
 *
 * Built on useSyncExternalStore (not useState + an effect) → SSR-safe by construction: the server and
 * the hydration render use `initial`, then the stored value is applied in one committed re-render with
 * NO hydration mismatch and no "setState in effect".
 */
const PREFIX = 'sakubun:';

// Cache the last parsed value per key so getSnapshot returns a STABLE reference while the raw string
// is unchanged (required by useSyncExternalStore — a fresh object each call would loop).
const cache = new Map<string, { raw: string | null; value: unknown }>();

function serialize<T>(value: T): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function deserialize<T>(raw: string, initial: T): T {
  if (typeof initial === 'string') return raw as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

function read<T>(storeKey: string, initial: T, urlKey?: string): T {
  if (typeof window === 'undefined') return initial;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(storeKey);
  } catch {
    return initial;
  }
  const hit = cache.get(storeKey);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = initial;
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  } else if (urlKey) {
    // Fresh load with nothing in sessionStorage yet — seed from the URL so a shared link restores it.
    const p = new URLSearchParams(window.location.search).get(urlKey);
    if (p != null) value = deserialize(p, initial);
  }
  cache.set(storeKey, { raw, value });
  return value;
}

function writeUrl<T>(urlKey: string, value: T, initial: T): void {
  const url = new URL(window.location.href);
  const str = serialize(value);
  if (str === serialize(initial) || str === '') url.searchParams.delete(urlKey);
  else url.searchParams.set(urlKey, str);
  window.history.replaceState(null, '', url);
}

const listeners = new Map<string, Set<() => void>>();

function subscribe(storeKey: string, cb: () => void): () => void {
  let set = listeners.get(storeKey);
  if (!set) {
    set = new Set();
    listeners.set(storeKey, set);
  }
  set.add(cb);
  // Cross-tab writes fire a `storage` event; same-tab writes are pushed via emit() below.
  const onStorage = (e: StorageEvent) => {
    if (e.key === storeKey) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    set?.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function emit(storeKey: string): void {
  listeners.get(storeKey)?.forEach((cb) => cb());
}

export function useSessionState<T>(
  key: string,
  initial: T,
  urlKey?: string,
): [T, Dispatch<SetStateAction<T>>] {
  const storeKey = PREFIX + key;
  // `useCallback` quanh subscribe: không có nó, mỗi render tạo một closure mới nên React HUỶ ĐĂNG KÝ và
  // đăng ký lại listener ở MỌI render. Lấy từ bản sao trong data-table.tsx lúc gom hai bản làm một
  // (2026-08-07) — bản sao đó làm đúng chỗ này, nên bản dùng chung nhận phần tốt hơn của cả hai thay vì
  // chỉ giữ bản có nhiều người dùng hơn.
  const subscribeToKey = useCallback((cb: () => void) => subscribe(storeKey, cb), [storeKey]);
  const value = useSyncExternalStore(
    subscribeToKey,
    () => read(storeKey, initial, urlKey),
    () => initial,
  );

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const prev = read(storeKey, initial, urlKey);
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      const raw = JSON.stringify(next);
      try {
        window.sessionStorage.setItem(storeKey, raw);
      } catch {
        // best-effort persistence; still update the in-memory cache so the UI reflects the change
      }
      cache.set(storeKey, { raw, value: next });
      if (urlKey) writeUrl(urlKey, next, initial);
      emit(storeKey);
    },
    [storeKey, initial, urlKey],
  );

  return [value, setValue];
}
