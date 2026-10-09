import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, APP_SCHEME } from '~/lib/config';

const storage = {
  getItem: (key: string) => SecureStore.getItem(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
};

const expoAuthPlugin = expoClient({
  scheme: APP_SCHEME,
  storagePrefix: APP_SCHEME,
  storage,
}) as unknown as BetterAuthClientPlugin;

const client = createAuthClient({ baseURL: API_BASE_URL, plugins: [expoAuthPlugin] });

if (typeof (client as { getCookie?: unknown }).getCookie !== 'function') {
  throw new Error(
    'Plugin Expo của better-auth không cung cấp getCookie() — kiểm tra lại version @better-auth/expo.',
  );
}

export const authClient = client as typeof client & { getCookie: () => string };
