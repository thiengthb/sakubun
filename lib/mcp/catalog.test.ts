import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

/**
 * Gates `MCP_CATALOG` against what the server ACTUALLY registers.
 *
 * The catalog's own header says "Adding/removing a tool or prompt in server.ts MUST update this list in
 * the same change" — which is a rule with nothing enforcing it, and it drifted: when the multi-user
 * surface was cut on 2026-08-03, `fork_shared_items` stopped being registered but stayed in the catalog.
 * The catalog was the DATA behind the /guide "Tra cứu" tool table; that page is gone, but the drift it
 * guards against is not — the catalog is still the only written record of what the MCP surface IS, and
 * both directions of drift really happened. The opposite one: the five group tools sat in the catalog
 * while `registerGroupTools` was never called, so the listed surface claimed a capability the server
 * could not do.
 *
 * Source-level on purpose (same technique as no-emoji / type-scale / layout-standard): building a real
 * McpServer to introspect it would drag the whole tool graph — DB client included — into a unit test, to
 * learn something a regex over the registration calls answers exactly. `server.tool(` / `server.prompt(`
 * IS the registration; there is no other way to add one.
 */

const TOOLS_DIR = 'lib/mcp/tools';
// server.ts registers the PROMPTS inline; the tools live one per domain file.
const SOURCES = [
  'lib/mcp/server.ts',
  ...readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(TOOLS_DIR, f)),
];

/** Every `server.tool('x'` / `server.prompt('x'` in the sources, as `kind` -> names. */
function registered(): Record<'tool' | 'prompt', Set<string>> {
  const found = { tool: new Set<string>(), prompt: new Set<string>() };
  for (const file of SOURCES) {
    const src = readFileSync(file, 'utf8');
    // The name is the first argument and usually sits on its own line after the open paren.
    for (const m of src.matchAll(/server\.(tool|prompt)\(\s*'([a-z_]+)'/g)) {
      found[m[1] as 'tool' | 'prompt'].add(m[2]);
    }
  }
  return found;
}

describe('MCP_CATALOG matches the server registrations', () => {
  const reg = registered();
  const catalog = new Map(MCP_CATALOG.map((e) => [e.name, e.kind]));

  it('finds registrations to compare against (guards the regex itself)', () => {
    expect(reg.tool.size).toBeGreaterThan(20);
    expect(reg.prompt.size).toBeGreaterThan(3);
  });

  // Also catches a WRONG `kind`: an entry marked 'tool' that is really a prompt is not in reg.tool, so
  // it shows up here — and the message says which side it was actually found on.
  it('every catalog entry is really registered, under the kind it claims', () => {
    const ghosts = MCP_CATALOG.filter((e) => !reg[e.kind].has(e.name)).map((e) => {
      const other = e.kind === 'tool' ? 'prompt' : 'tool';
      return reg[other].has(e.name) ? `${e.name} (listed as ${e.kind}, is a ${other})` : e.name;
    });
    expect(
      ghosts,
      'These are in MCP_CATALOG but the server never registers them — Claude will not have them. ' +
        `Remove the row, or register it:\n  ${ghosts.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every registered tool/prompt is in the catalog', () => {
    const missing: string[] = [];
    for (const kind of ['tool', 'prompt'] as const) {
      for (const name of reg[kind]) if (!catalog.has(name)) missing.push(`${name} (${kind})`);
    }
    expect(
      missing,
      'These are registered on the MCP server but missing from MCP_CATALOG, so the only written record ' +
        `of the surface is incomplete:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('has no duplicate names', () => {
    expect(catalog.size).toBe(MCP_CATALOG.length);
  });
});
