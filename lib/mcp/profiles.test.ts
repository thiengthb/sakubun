import { describe, expect, it } from 'vitest';
import { parseProfile, TUTOR_TOOLS, type McpProfile } from '@/lib/mcp/profiles';
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
  it('full đăng ký mọi tool, kể cả các tool ngoài vòng học', () => {
    const { tools } = registered('full');
    expect(tools.length).toBeGreaterThan(TUTOR_TOOLS.length);
    expect(tools).toContain('enrich_items');
  });

  it('tutor chỉ đăng ký đúng danh sách vòng học', () => {
    expect(registered('tutor').tools.sort()).toEqual([...TUTOR_TOOLS].sort());
  });

  it('mọi tên trong TUTOR_TOOLS đều là tool có thật (đổi tên tool thì test này đỏ)', () => {
    const all = new Set(registered('full').tools);
    expect(TUTOR_TOOLS.filter((t) => !all.has(t))).toEqual([]);
  });

  it('prompt giữ nguyên ở cả hai profile', () => {
    expect(registered('tutor').prompts).toEqual(registered('full').prompts);
  });

  it('parseProfile: không có tham số = full, tên lạ = null', () => {
    expect(parseProfile(null)).toBe('full');
    expect(parseProfile('')).toBe('full');
    expect(parseProfile('tutor')).toBe('tutor');
    expect(parseProfile('admin')).toBeNull();
  });
});
