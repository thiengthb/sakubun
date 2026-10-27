// Where the app is served, for links that leave the page (OAuth issuer, links in MCP results). An
// unset BETTER_AUTH_URL falls back to the dev server instead of being derived from each request.
export const APP_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3789';

export function appLink(path: string): string {
  return new URL(path, APP_URL).href;
}
