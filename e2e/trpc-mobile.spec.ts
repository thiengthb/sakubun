import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_LOGIN, seedE2eAccount } from './fixtures';

const NATIVE_ORIGIN = 'sakubun://';

test.beforeAll(async () => {
  await seedE2eAccount();
});

test('a procedure refuses an unauthenticated request', async ({ request }) => {
  const res = await request.get('/api/trpc/me');
  expect(res.status()).toBe(401);
  const body = (await res.json()) as { error?: { data?: { code?: string } } };
  expect(body.error?.data?.code).toBe('UNAUTHORIZED');
});

test('the login screen can ask which sign-in methods exist, with no session', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const res = await api.get('/api/trpc/authConfig');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { result: { data: { googleEnabled: boolean } } };
    expect(typeof body.result.data.googleEnabled).toBe('boolean');
  } finally {
    await api.dispose();
  }
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

  const me = await request.get('/api/trpc/me');
  expect(me.status()).toBe(200);
  const meBody = (await me.json()) as { result: { data: { email: string } } };
  expect(meBody.result.data.email).toBe(E2E_EMAIL);

  const snap = await request.get('/api/trpc/snapshot');
  expect(snap.status()).toBe(200);
  const snapBody = (await snap.json()) as {
    result: { data: { takenAt: string; counts: { items: number }; settings: unknown } };
  };
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
  expect(Number.isFinite(stats.today.reviews)).toBe(true);
  expect(Number.isFinite(stats.streak.current)).toBe(true);
  expect(Number.isFinite(stats.sessionGoal)).toBe(true);
  expect(stats.reviewsByDay).toHaveLength(7);
});

test('a native client is accepted on `expo-origin` alone, with no `origin` header', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: test.info().project.use.baseURL,
    extraHTTPHeaders: { 'expo-origin': NATIVE_ORIGIN },
  });
  try {
    const signIn = await api.post('/api/auth/sign-in/email', {
      data: { email: E2E_EMAIL, password: E2E_LOGIN },
    });
    expect(signIn.status(), await signIn.text()).not.toBe(403);
    expect(signIn.ok()).toBeTruthy();

    const me = await api.get('/api/trpc/me');
    expect(me.status()).toBe(200);
  } finally {
    await api.dispose();
  }
});
