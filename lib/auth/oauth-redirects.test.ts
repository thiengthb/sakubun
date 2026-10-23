import { describe, expect, it } from 'vitest';
import { isAllowedRedirectUri } from './oauth-redirects';

describe('isAllowedRedirectUri', () => {
  it('cho callback của claude.ai, ChatGPT và loopback của Claude Code', () => {
    for (const uri of [
      'https://claude.ai/api/mcp/auth_callback',
      'https://chatgpt.com/connector_platform_oauth_redirect',
      'https://chatgpt.com/connector/oauth/AbC_123-x',
      'http://localhost:3118/callback',
      'http://127.0.0.1:54321/callback',
      'http://localhost/callback',
    ]) {
      expect(isAllowedRedirectUri(uri), uri).toBe(true);
    }
  });

  it('chặn mọi host khác và mọi biến thể lách luật', () => {
    for (const uri of [
      'https://evil.example/api/mcp/auth_callback',
      'https://claude.ai.evil.example/api/mcp/auth_callback',
      'http://claude.ai/api/mcp/auth_callback',
      'https://claude.ai/api/mcp/auth_callback?next=https://evil.example',
      'https://claude.ai/api/mcp/auth_callback#x',
      'https://user@claude.ai/api/mcp/auth_callback',
      'https://claude.ai:8443/api/mcp/auth_callback',
      'https://claude.ai/api/mcp/other',
      'https://chatgpt.com/connector/oauth/a/b',
      'https://chatgpt.com/connector/oauth/',
      'https://chatgpt.com/somewhere',
      'https://localhost:3118/callback',
      'http://localhost:3118/other',
      'http://192.168.1.5:3118/callback',
      'http://[::1]:3118/callback',
      'not a url',
      '',
    ]) {
      expect(isAllowedRedirectUri(uri), uri).toBe(false);
    }
  });
});
