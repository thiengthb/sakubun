import { describe, expect, it } from 'vitest';
import { parseProfile, PLANNER_TOOLS, V2_TOOLS, type McpProfile } from '@/lib/mcp/profiles';
import { registerAll } from '@/lib/mcp/server';

// A stand-in server that only records what gets registered.
function registered(profile: McpProfile) {
  const tools: string[] = [];
  const prompts: string[] = [];
  const fake = {
    tool: (name: string) => void tools.push(name),
    prompt: (name: string) => void prompts.push(name),
  };
  registerAll(fake as never, profile);
  return { tools, prompts };
}

describe('MCP profiles', () => {
  it('v2 có bảy tool học, example_add, bốn tool Kaiwa, hai tool Kho chung và hai prompt hoc, kaiwa', () => {
    const { tools, prompts } = registered('v2');
    expect(tools.sort()).toEqual([...V2_TOOLS].sort());
    expect(tools).toHaveLength(14);
    expect(prompts).toEqual(['hoc', 'kaiwa']);
  });

  it('planner chỉ có ping + get_review_load (đọc số liệu, không nội dung), không prompt', () => {
    const { tools, prompts } = registered('planner');
    expect(tools.sort()).toEqual([...PLANNER_TOOLS].sort());
    expect(prompts).toEqual([]);
  });

  it('parseProfile: không tham số và tên cũ full = v2; tutor (Hermes học, đã bỏ) và tên lạ = null', () => {
    for (const value of [null, '', 'v2', 'full']) expect(parseProfile(value)).toBe('v2');
    expect(parseProfile('planner')).toBe('planner');
    expect(parseProfile('tutor')).toBeNull();
    expect(parseProfile('admin')).toBeNull();
  });
});
