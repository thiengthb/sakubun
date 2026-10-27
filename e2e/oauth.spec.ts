import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_LOGIN } from './fixtures';
import { MCP_URL, parseRpc, seedMcpAccount } from './mcp-client';

// The OAuth provider behind /api/mcp (roadmap 4.1), driven the way claude.ai drives it: register a
// client (DCR), send thien through /login and /consent, trade the code for tokens, refresh them, and
// call /api/mcp with the access token.

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

type Tokens = { access_token: string; refresh_token?: string; token_type: string };

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

function authorizeUrl(
  clientId: string,
  redirectUri: string,
  challenge: string,
  withResource = true,
): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'openid offline_access',
    state: 'state-123',
  });
  if (withResource) q.set('resource', MCP_URL);
  return `/api/auth/oauth2/authorize?${q}`;
}

async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Mật khẩu').fill(E2E_LOGIN);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

async function signInDirectly(page: Page): Promise<void> {
  await page.goto('/login');
  await signIn(page);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

function jwtPayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<
    string,
    unknown
  >;
}

async function token(
  api: APIRequestContext,
  form: Record<string, string>,
  withResource = true,
): Promise<Tokens> {
  const res = await api.post('/api/auth/oauth2/token', {
    form: withResource ? { ...form, resource: MCP_URL } : form,
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as Tokens;
}

// The whole claude.ai handshake, from a signed-out browser to a token pair.
async function connect(
  page: Page,
  api: APIRequestContext,
  withResource = true,
): Promise<{ clientId: string; tokens: Tokens }> {
  const clientId = await register(api, CLAUDE_CALLBACK);
  const { verifier, challenge } = pkce();

  // claude.ai is not reachable from the test; stop at its callback and read the code off the URL.
  let callback: URL | null = null;
  await page.route('https://claude.ai/**', (route) => {
    callback = new URL(route.request().url());
    return route.fulfill({ status: 200, body: 'claude.ai' });
  });

  await page.goto(authorizeUrl(clientId, CLAUDE_CALLBACK, challenge, withResource));
  await expect(page).toHaveURL(/\/login\?/);
  await signIn(page);

  await expect(page.getByText('Cho phép truy cập Sakubun?')).toBeVisible({ timeout: 30_000 });
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

  const tokens = await token(
    api,
    {
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: CLAUDE_CALLBACK,
      client_id: clientId,
      code_verifier: verifier,
    },
    withResource,
  );
  return { clientId, tokens };
}

async function mcp(api: APIRequestContext, accessToken: string | null, method: string) {
  return api.post(MCP_URL, {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method,
      params:
        method === 'initialize'
          ? {
              protocolVersion: '2025-06-18',
              capabilities: {},
              clientInfo: { name: 'e2e-oauth', version: '0' },
            }
          : {},
    },
  });
}

async function toolNames(api: APIRequestContext, accessToken: string): Promise<string[]> {
  expect((await mcp(api, accessToken, 'initialize')).status()).toBe(200);
  const res = await mcp(api, accessToken, 'tools/list');
  expect(res.status(), await res.text()).toBe(200);
  const body = parseRpc(await res.text()) as { result: { tools: { name: string }[] } };
  return body.result.tools.map((t) => t.name).sort();
}

test('claude.ai kết nối được: đăng nhập, đồng ý, gọi /api/mcp, rồi refresh', async ({
  page,
  request,
}) => {
  await seedMcpAccount();
  const { clientId, tokens: first } = await connect(page, request);
  expect(first.token_type.toLowerCase()).toBe('bearer');
  const claims = jwtPayload(first.access_token);
  expect(claims.aud === MCP_URL || (claims.aud as string[]).includes(MCP_URL)).toBe(true);
  expect(claims.azp).toBe(clientId);
  expect(first.refresh_token).toBeTruthy();

  expect(await toolNames(request, first.access_token)).toContain('next_turn');

  const second = await token(request, {
    grant_type: 'refresh_token',
    refresh_token: first.refresh_token!,
    client_id: clientId,
  });
  expect(second.refresh_token, 'refresh token phải xoay vòng').not.toBe(first.refresh_token);
  expect(await toolNames(request, second.access_token)).toContain('next_turn');
});

// Roadmap 4.2: the learner takes an app back in Cài đặt; its token stops at once and cannot refresh.
test('thu hồi ứng dụng trong Cài đặt: token đang có hết hiệu lực ngay, refresh bị từ chối', async ({
  page,
  request,
}) => {
  await seedMcpAccount();
  // Earlier tests connected apps named Claude too; this one counts on being the only one.
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.exec('DELETE FROM oauthConsent');
  db.close();
  const { clientId, tokens } = await connect(page, request);
  expect(await toolNames(request, tokens.access_token)).toContain('next_turn');

  await page.goto('/settings?tab=account', { waitUntil: 'networkidle' });
  const section = page
    .getByRole('heading', { name: 'Ứng dụng đã kết nối', exact: true })
    .locator('xpath=ancestor::section[1]');
  await expect(section.getByText('Claude', { exact: true })).toBeVisible();
  const shots = process.env.SCREENSHOT_DIR;
  if (shots)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${shots}/connected-apps-${width}.png` });
    }

  await section.getByRole('button', { name: 'Thu hồi quyền của Claude' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Thu hồi' }).click();
  await expect(section.getByText('Chưa có ứng dụng nào.')).toBeVisible();

  expect((await mcp(request, tokens.access_token, 'initialize')).status()).toBe(401);
  const refresh = await request.post('/api/auth/oauth2/token', {
    form: {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token!,
      client_id: clientId,
      resource: MCP_URL,
    },
  });
  expect(refresh.ok()).toBe(false);
});

// The MCP spec makes clients send `resource` (RFC 8707); claude.ai and ChatGPT do. Without it the
// provider issues an opaque token for no audience, and /api/mcp only honours tokens bound to itself.
test('token không gắn với /api/mcp (client không gửi resource) bị từ chối', async ({
  page,
  request,
}) => {
  await seedMcpAccount();
  const { tokens } = await connect(page, request, false);
  expect((await mcp(request, tokens.access_token, 'initialize')).status()).toBe(401);
});

test('/api/mcp không token trả 401 chỉ đường tới metadata; token bị sửa cũng 401', async ({
  request,
}) => {
  const none = await mcp(request, null, 'initialize');
  expect(none.status()).toBe(401);
  expect(none.headers()['www-authenticate']).toContain(
    `resource_metadata="${E2E_BASE_URL}/.well-known/oauth-protected-resource"`,
  );

  const forged = [
    Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'x', aud: MCP_URL })).toString('base64url'),
    'c2ln',
  ].join('.');
  expect((await mcp(request, forged, 'initialize')).status()).toBe(401);
});

// The jwt() plugin's session JWT is signed with the same key as the access tokens; only its issuer and
// audience differ, and /api/mcp must notice.
test('JWT phiên đăng nhập (/api/auth/token) không mở được /api/mcp', async ({ page }) => {
  await seedMcpAccount();
  await signInDirectly(page);
  const res = await page.request.get('/api/auth/token');
  expect(res.ok(), await res.text()).toBe(true);
  const sessionJwt = ((await res.json()) as { token: string }).token;
  expect(sessionJwt.split('.')).toHaveLength(3);
  expect((await mcp(page.request, sessionJwt, 'initialize')).status()).toBe(401);
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

  await signInDirectly(page);
  await page.goto(authorizeUrl(clientId, evil, pkce().challenge));
  await expect(page.getByText('Cho phép truy cập Sakubun?')).toHaveCount(0);
  expect(page.url()).not.toContain('evil.example');
  expect(reached).toBe(false);
});

test('trang đồng ý không có nút khi liên kết bị sửa', async ({ page }) => {
  await seedMcpAccount();
  await signInDirectly(page);
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
