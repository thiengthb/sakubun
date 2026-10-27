'use client';

import { useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'sakubun:';
const LOCAL_PREFIX = 'sakubun.local:';

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

type Area = 'session' | 'local';

function storage(area: Area): Storage {
  return area === 'local' ? window.localStorage : window.sessionStorage;
}

function read<T>(storeKey: string, initial: T, urlKey?: string, area: Area = 'session'): T {
  if (typeof window === 'undefined') return initial;
  let raw: string | null;
  try {
    raw = storage(area).getItem(storeKey);
  } catch {
    return initial;
  }
  // A ?tab= in the address wins over the stored value: a link such as /settings?tab=guide must land
  // on that tab even if the learner left another one open earlier. setValue keeps both in step.
  const fromUrl = urlKey ? new URLSearchParams(window.location.search).get(urlKey) : null;
  const key = fromUrl != null ? `url:${fromUrl}` : raw;
  const hit = cache.get(storeKey);
  if (hit && hit.raw === key) return hit.value as T;
  let value = initial;
  if (fromUrl != null) {
    value = deserialize(fromUrl, initial);
  } else if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  cache.set(storeKey, { raw: key, value });
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
  return useStoredState(PREFIX + key, initial, urlKey, 'session');
}

/** useSessionState that outlives the tab: for progress the learner comes back to another day. */
export function useLocalState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  // Its own prefix, so a key never reads the other area's cached value.
  return useStoredState(LOCAL_PREFIX + key, initial, undefined, 'local');
}

function useStoredState<T>(
  storeKey: string,
  initial: T,
  urlKey: string | undefined,
  area: Area,
): [T, Dispatch<SetStateAction<T>>] {
  const subscribeToKey = useCallback((cb: () => void) => subscribe(storeKey, cb), [storeKey]);
  const value = useSyncExternalStore(
    subscribeToKey,
    () => read(storeKey, initial, urlKey, area),
    () => initial,
  );

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const prev = read(storeKey, initial, urlKey, area);
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      const raw = JSON.stringify(next);
      try {
        storage(area).setItem(storeKey, raw);
      } catch {}
      cache.set(storeKey, { raw, value: next });
      if (urlKey) writeUrl(urlKey, next, initial);
      emit(storeKey);
    },
    [storeKey, initial, urlKey, area],
  );

  return [value, setValue];
}
