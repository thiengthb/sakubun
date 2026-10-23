// Where an OAuth authorization code may be sent. Anyone can register a client (claude.ai and ChatGPT
// register themselves), so this list is what keeps a code for thien's account from reaching a host
// that is not Claude or ChatGPT. Checked on every authorize request, after better-auth's own
// exact match against the client's registered URIs.

const EXACT = new Set([
  // claude.ai on the web, Claude Desktop, the Claude phone apps and Cowork.
  'https://claude.ai/api/mcp/auth_callback',
  // ChatGPT when the authorization server sends `iss` back (RFC 9207).
  'https://chatgpt.com/connector_platform_oauth_redirect',
]);

// ChatGPT without RFC 9207 support: one callback id per connection.
const CHATGPT_CALLBACK = /^\/connector\/oauth\/[A-Za-z0-9_-]+$/;

// Claude Code redirects to a loopback port that changes every session (RFC 8252).
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash || url.search) return false;
  if (EXACT.has(`${url.origin}${url.pathname}`)) return true;
  if (url.protocol === 'https:' && url.host === 'chatgpt.com') {
    return CHATGPT_CALLBACK.test(url.pathname);
  }
  return (
    url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) && url.pathname === '/callback'
  );
}
