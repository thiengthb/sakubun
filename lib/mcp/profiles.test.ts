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
  it('v2 chỉ có bảy tool mới và một prompt hoc', () => {
    const { tools, prompts } = registered('v2');
    expect(tools.sort()).toEqual([...V2_TOOLS].sort());
    expect(prompts).toEqual(['hoc']);
  });

  it('planner chỉ có ping + get_review_load (đọc số liệu, không nội dung), không prompt', () => {
    const { tools, prompts } = registered('planner');
    expect(tools.sort()).toEqual([...PLANNER_TOOLS].sort());
    expect(prompts).toEqual([]);
  });

  it('parseProfile: không tham số và tên cũ (full, tutor) = v2, tên lạ = null', () => {
    for (const value of [null, '', 'v2', 'full', 'tutor']) expect(parseProfile(value)).toBe('v2');
    expect(parseProfile('planner')).toBe('planner');
    expect(parseProfile('admin')).toBeNull();
  });
});
