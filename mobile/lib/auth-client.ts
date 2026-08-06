import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, APP_SCHEME } from '~/lib/config';

// The native half of better-auth. It is NOT a bearer-token scheme: the plugin keeps a cookie jar in
// SecureStore, reads `Set-Cookie` off each response, and re-attaches the cookie by hand on the next
// request. Anything that talks to the server therefore has to ask this client for the cookie —
// see lib/api.ts.
//
// WHY A CUSTOM `storage` (better-auth #10382). `expoClient` calls `getItem` SYNCHRONOUSLY (it inspects
// the returned string directly), so only `SecureStore.getItem` — the JSI sync API — can back it;
// AsyncStorage is structurally unusable here. And SecureStore's default keychain accessibility is
// `WhenUnlocked`, so when iOS wakes the app in the background on a LOCKED phone the keychain read
// throws natively and surfaces as a full-screen crash. Writing with AFTER_FIRST_UNLOCK is the fix.
//
// REMOVE THIS WRAPPER when the app moves to better-auth 1.7 (still 1.7.0-rc.4 as of 2026-08-06): that
// release makes the Expo client use the async SecureStore APIs, and `authClient.getCookie()` becomes a
// Promise — a breaking change that this file and lib/api.ts both have to absorb together.
const storage = {
  getItem: (key: string) => SecureStore.getItem(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
};

// WHY THE CAST. In the published 1.6.26 pair, `expoClient()`'s `getActions` is declared with a
// narrower `BetterFetch<...>` and one fewer parameter than `BetterAuthClientPlugin` expects, so the
// plugin does not structurally satisfy the very interface it is written for. Verified as an upstream
// mismatch, not a local one: better-auth and @better-auth/expo are both 1.6.26 here and there is
// exactly ONE deduped copy of @better-fetch/fetch (1.3.1). The runtime object is fine — this is
// variance in the declarations. Re-check when 1.7 goes stable; the cast should be removable.
const expoAuthPlugin = expoClient({
  scheme: APP_SCHEME,
  storagePrefix: APP_SCHEME,
  storage,
}) as unknown as BetterAuthClientPlugin;

const client = createAuthClient({ baseURL: API_BASE_URL, plugins: [expoAuthPlugin] });

// The cast above also erases the inference for `getCookie`, which the plugin contributes at runtime.
// A silent lie here is the worst possible failure: every request would go out with no cookie and the
// app would look "logged out" forever. So assert it at module load — fail loudly, at launch, once.
if (typeof (client as { getCookie?: unknown }).getCookie !== 'function') {
  throw new Error(
    'Plugin Expo của better-auth không cung cấp getCookie() — kiểm tra lại version @better-auth/expo.',
  );
}

export const authClient = client as typeof client & { getCookie: () => string };
