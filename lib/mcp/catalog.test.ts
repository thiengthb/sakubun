import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_CATALOG } from '@/lib/mcp/catalog';

const TOOLS_DIR = 'lib/mcp/tools';
const SOURCES = [
  'lib/mcp/server.ts',
  ...readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(TOOLS_DIR, f)),
];

function registered(): Record<'tool' | 'prompt', Set<string>> {
  const found = { tool: new Set<string>(), prompt: new Set<string>() };
  for (const file of SOURCES) {
    const src = readFileSync(file, 'utf8');
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
