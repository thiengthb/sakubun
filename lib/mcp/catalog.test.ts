import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_CATALOG } from '@/lib/mcp/catalog';
import { MCP_PROMPTS } from '@/lib/mcp/prompts';
import { HOC_PROMPT } from '@/lib/mcp/v2-prompt';

const TOOLS_DIR = 'lib/mcp/tools';
const SOURCES = readdirSync(TOOLS_DIR)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => join(TOOLS_DIR, f));

// Tools are still found by scanning source: each register*Tools() calls server.tool('name', …)
// inline, so the names exist only as literals. Prompts are a declared table, so they are read
// directly — comparing data to data instead of trusting a regex to keep matching the call shape.
// prompts.ts is pure data with no side effects, unlike server.ts (which builds the handler on
// import and would drag the database in).
function registered(): Record<'tool' | 'prompt', Set<string>> {
  const found = {
    tool: new Set<string>(),
    prompt: new Set([...MCP_PROMPTS.map((p) => p.name), HOC_PROMPT.name]),
  };
  for (const file of SOURCES) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/server\.tool\(\s*'([a-z_]+)'/g)) found.tool.add(m[1]);
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
