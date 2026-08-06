// The mobile transport over REAL HTTP. Three things, and the third is the reason this file exists.
//
// 1. No session -> 401. The learning tables have no `userId` column, so `protectedProcedure` is the only
//    thing between the public internet and the library. Asserted over the wire, not through a caller.
// 2. A real cookie session -> data. Proves the `Cookie` header path the native client actually uses
//    (@better-auth/expo keeps a cookie jar in SecureStore and re-attaches it by hand).
// 3. `expo-origin` is accepted. The Expo client sends that header on EVERY call, including plain email
//    sign-in, and better-auth's origin check would answer 403 MISSING_OR_NULL_ORIGIN without the
//    `expo()` plugin plus `sakubun://` in trustedOrigins. That failure reads like bad credentials and
//    costs an afternoon on a device. It is deterministic here, so it is gated here.
import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const NATIVE_ORIGIN = 'sakubun://';

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('a procedure refuses an unauthenticated request', async ({ request }) => {
  const res = await request.get('/api/trpc/me');
  expect(res.status()).toBe(401);
  // No transformer, so the envelope is tRPC's plain shape: `error.data.code`, NOT superjson's
  // `error.json.data.code`. The client reads this field to tell "sign in again" from "server is down".
  const body = (await res.json()) as { error?: { data?: { code?: string } } };
  expect(body.error?.data?.code).toBe('UNAUTHORIZED');
});

test('the snapshot is unreadable without a session', async ({ request }) => {
  const res = await request.get('/api/trpc/snapshot');
  expect(res.status()).toBe(401);
});

test('a cookie session reads its own library', async ({ request, baseURL }) => {
  const signIn = await request.post('/api/auth/sign-in/email', {
    headers: { origin: baseURL! },
    data: { email: E2E_EMAIL, password: E2E_LOGIN },
  });
  expect(signIn.ok()).toBeTruthy();

  // The APIRequestContext keeps the session cookie, which is exactly what the native cookie jar does.
  const me = await request.get('/api/trpc/me');
  expect(me.status()).toBe(200);
  const meBody = (await me.json()) as { result: { data: { email: string } } };
  expect(meBody.result.data.email).toBe(E2E_EMAIL);

  const snap = await request.get('/api/trpc/snapshot');
  expect(snap.status()).toBe(200);
  const snapBody = (await snap.json()) as {
    result: { data: { takenAt: string; counts: { items: number }; settings: unknown } };
  };
  // Dates on the wire are ISO strings, never Date objects — the whole reason this ships without a
  // transformer (lib/trpc/init.ts). A regression here is a lying client type.
  expect(typeof snapBody.result.data.takenAt).toBe('string');
  expect(Number.isFinite(snapBody.result.data.counts.items)).toBe(true);
  expect(snapBody.result.data.settings).toBeTruthy();
});

test('progress numbers arrive already computed', async ({ request, baseURL }) => {
  await request.post('/api/auth/sign-in/email', {
    headers: { origin: baseURL! },
    data: { email: E2E_EMAIL, password: E2E_LOGIN },
  });
  const res = await request.get('/api/trpc/stats');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    result: {
      data: {
        today: { reviews: number; sentences: number };
        streak: { current: number };
        reviewsByDay: { day: string; count: number }[];
        sessionGoal: number;
      };
    };
  };
  const stats = body.result.data;
  // The app renders these as-is. If any of them were missing the client would have to derive it from
  // timestamps, which is precisely the thing the study-day cutoff makes wrong on a phone.
  expect(Number.isFinite(stats.today.reviews)).toBe(true);
  expect(Number.isFinite(stats.streak.current)).toBe(true);
  expect(Number.isFinite(stats.sessionGoal)).toBe(true);
  expect(stats.reviewsByDay).toHaveLength(7);
});

test('a native client is accepted on `expo-origin` alone, with no `origin` header', async ({
  playwright,
}) => {
  // A fresh context: no cookies, so this is a first-launch native sign-in and nothing else.
  const api = await playwright.request.newContext({
    baseURL: test.info().project.use.baseURL,
    extraHTTPHeaders: { 'expo-origin': NATIVE_ORIGIN },
  });
  try {
    const signIn = await api.post('/api/auth/sign-in/email', {
      data: { email: E2E_EMAIL, password: E2E_LOGIN },
    });
    // The assertion that matters is "not rejected for its origin". A 403 here means either the expo()
    // plugin is missing/misordered or `sakubun://` fell out of trustedOrigins.
    expect(signIn.status(), await signIn.text()).not.toBe(403);
    expect(signIn.ok()).toBeTruthy();

    const me = await api.get('/api/trpc/me');
    expect(me.status()).toBe(200);
  } finally {
    await api.dispose();
  }
});
