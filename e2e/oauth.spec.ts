import { createHash, randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_BASE_URL, E2E_EMAIL, E2E_LOGIN } from './fixtures';
import { MCP_URL, seedMcpAccount } from './mcp-client';

// The OAuth provider behind /api/mcp (roadmap 4.1), driven the way claude.ai drives it: register a
// client (DCR), send thien through /login and /consent, trade the code for tokens, refresh them.

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

async function register(api: APIRequestContext, redirectUri: string): Promise<string> {
  const res = await api.post('/api/auth/oauth2/register', {
    headers: { origin: E2E_BASE_URL },
    data: {
      client_name: 'Claude',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { client_id: string }).client_id;
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

function authorizeUrl(clientId: string, redirectUri: string, challenge: string): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'openid offline_access',
    state: 'state-123',
    resource: MCP_URL,
  });
  return `/api/auth/oauth2/authorize?${q}`;
}

async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

function jwtPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<
    string,
    unknown
  >;
}

async function token(api: APIRequestContext, form: Record<string, string>) {
  const res = await api.post('/api/auth/oauth2/token', { form: { ...form, resource: MCP_URL } });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { access_token: string; refresh_token?: string; token_type: string };
}

test('claude.ai kết nối được: đăng nhập, đồng ý, đổi code lấy token, rồi refresh', async ({
  page,
  request,
}) => {
  await seedMcpAccount();
  const clientId = await register(request, CLAUDE_CALLBACK);
  const { verifier, challenge } = pkce();

  // claude.ai is not reachable from the test; stop at its callback and read the code off the URL.
  let callback: URL | null = null;
  await page.route('https://claude.ai/**', (route) => {
    callback = new URL(route.request().url());
    return route.fulfill({ status: 200, body: 'claude.ai' });
  });

  await page.goto(authorizeUrl(clientId, CLAUDE_CALLBACK, challenge));
  await expect(page).toHaveURL(/\/login\?/);
  await signIn(page);

  await expect(page.getByText('Cho phép truy cập sakubun?')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('claude.ai', { exact: true })).toBeVisible();
  // A click before hydration does nothing on a freshly compiled dev page.
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Cho phép' }).click();
  await expect
    .poll(() => callback?.toString() ?? '', { timeout: 30_000 })
    .toContain(CLAUDE_CALLBACK);

  const got = callback as unknown as URL;
  expect(got.searchParams.get('state')).toBe('state-123');
  const code = got.searchParams.get('code');
  expect(code).toBeTruthy();

  const first = await token(request, {
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: CLAUDE_CALLBACK,
    client_id: clientId,
    code_verifier: verifier,
  });
  expect(first.token_type.toLowerCase()).toBe('bearer');
  const claims = jwtPayload(first.access_token);
  expect(claims.aud === MCP_URL || (claims.aud as string[]).includes(MCP_URL)).toBe(true);
  expect(claims.azp).toBe(clientId);
  expect(first.refresh_token).toBeTruthy();

  const second = await token(request, {
    grant_type: 'refresh_token',
    refresh_token: first.refresh_token!,
    client_id: clientId,
  });
  expect(second.access_token).toBeTruthy();
  expect(second.refresh_token, 'refresh token phải xoay vòng').not.toBe(first.refresh_token);
});

test('callback lạ không bao giờ nhận được code, kể cả khi client đã đăng ký nó', async ({
  page,
  request,
}) => {
  await seedMcpAccount();
  const evil = 'https://evil.example/callback';
  const clientId = await register(request, evil);
  let reached = false;
  await page.route('https://evil.example/**', (route) => {
    reached = true;
    return route.fulfill({ status: 200, body: 'evil' });
  });

  await page.goto('/login');
  await signIn(page);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto(authorizeUrl(clientId, evil, pkce().challenge));
  await expect(page.getByText('Cho phép truy cập sakubun?')).toHaveCount(0);
  expect(page.url()).not.toContain('evil.example');
  expect(reached).toBe(false);
});

test('trang đồng ý không có nút khi liên kết bị sửa', async ({ page }) => {
  await seedMcpAccount();
  await page.goto('/login');
  await signIn(page);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });

  await page.goto(
    '/consent?client_id=x&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&exp=9999999999&sig=forged',
  );
  await expect(page.getByText('Yêu cầu không hợp lệ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cho phép' })).toHaveCount(0);
});

test('metadata khám phá nằm ở gốc tên miền và trỏ đúng về /api/mcp', async ({ request }) => {
  const resource = await request.get('/.well-known/oauth-protected-resource');
  expect(resource.ok()).toBe(true);
  const meta = (await resource.json()) as { resource: string; authorization_servers: string[] };
  expect(meta.resource).toBe(MCP_URL);

  const issuer = new URL(meta.authorization_servers[0]);
  const as = await request.get(`/.well-known/oauth-authorization-server${issuer.pathname}`);
  expect(as.ok()).toBe(true);
  const server = (await as.json()) as Record<string, unknown>;
  expect(server.issuer).toBe(meta.authorization_servers[0]);
  expect(server.code_challenge_methods_supported).toContain('S256');
  expect(server.registration_endpoint).toBeTruthy();
  expect(server.grant_types_supported, 'không có token nào cấp mà không qua thien').toEqual([
    'authorization_code',
    'refresh_token',
  ]);
});
