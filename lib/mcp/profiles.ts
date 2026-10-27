// Which tools each MCP client sees (roadmap 3.2). `v2` is the default: the seven server-led tools, the
// three Kaiwa tools and the two Kho chung tools (phase 8) and the `hoc` and `kaiwa` prompts, for Claude Desktop and ChatGPT. `planner` is for a scheduling
// assistant (e.g. a calendar bot): load COUNTS only, read-only, no item content. A key whose scope is
// `planner` can never reach any other profile (app/api/[transport]/route.ts).
export const V2_TOOLS = [
  'next_turn',
  'stage_turn',
  'grade_turn',
  'skip_turn',
  'lookup',
  'add_items',
  'status',
  'kaiwa_list',
  'kaiwa_get',
  'kaiwa_save',
  'library_search',
  'library_take',
] as const;

export const PLANNER_TOOLS = ['ping', 'get_review_load'] as const;

export type McpProfile = 'v2' | 'planner';

// `full` (the old default name) still gets the v2 set. `tutor` (the Hermes study bot) is gone: thien
// dropped Hermes study on 2026-10-23, so it answers 400 like any unknown name rather than guessing.
export function parseProfile(value: string | null): McpProfile | null {
  if (value === null || value === '' || value === 'v2' || value === 'full') return 'v2';
  if (value === 'planner') return 'planner';
  return null;
}
