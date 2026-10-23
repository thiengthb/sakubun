# 0002. OAuth for /api/mcp through better-auth's MCP plugin

- Status: accepted (plan approved by thien on 2026-10-23, option "Claude + ChatGPT")
- Date: 2026-10-23

## Context

Roadmap 4.1: sakubun should work as a connector added on claude.ai and used from the Claude phone app,
which only speaks OAuth (no pasted bearer tokens). ChatGPT connectors use the same flow. The existing
MCP keys (Claude Desktop through mcp-remote, the Hermes assistant on `?profile=planner`) must keep
working. sakubun has one user; anything that can mint a token for that account must go through thien.

## Decision

- better-auth 1.7 with `@better-auth/mcp` (the OAuth 2.1 provider configured for MCP) and `jwt()` for
  signing keys stored in the DB. The 1.6 `mcp` plugin is deprecated, so it is not used.
- Clients register themselves with Dynamic Client Registration. Client ID Metadata Documents are not
  enabled: `@better-auth/cimd` needs an application-written SSRF-safe fetch transport, and both
  claude.ai and ChatGPT fall back to DCR.
- Codes and tokens only go to known callbacks (`lib/auth/oauth-redirects.ts`): claude.ai, ChatGPT and
  Claude Code's loopback. Registering another redirect URI succeeds but can never be used.
- Only `authorization_code` and `refresh_token` grants. No `client_credentials`, so no token exists
  without thien signing in on `/login` (Google, `ALLOWED_EMAIL`) and approving on `/consent`.
- Discovery metadata is served at the site root (`/.well-known/oauth-protected-resource`,
  `/.well-known/oauth-authorization-server/api/auth`); the token audience is `<BETTER_AUTH_URL>/api/mcp`.

## Consequences

- An additive migration adds the provider's tables (`oauthClient`, tokens, consent, `jwks`, ...).
  The app never queries them directly.
- `BETTER_AUTH_URL` is now required to be right in production: it is the token issuer and audience.
- Revoking a connected app is not in the UI yet (deferred by thien); deleting the session or the
  client row revokes it meanwhile.
