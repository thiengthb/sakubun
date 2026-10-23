// Which tools each MCP client sees (roadmap 3.2). `v2` is the default: the seven server-led tools and
// the one `hoc` prompt, for Claude Desktop, ChatGPT and Hermes alike. `planner` is for a scheduling
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
] as const;

export const PLANNER_TOOLS = ['ping', 'get_review_load'] as const;

export type McpProfile = 'v2' | 'planner';

// Old profile names still in client configs (`full`, and `tutor` in Hermes) now get the v2 set.
// null = not a profile we know; the route answers 400 rather than guessing.
export function parseProfile(value: string | null): McpProfile | null {
  if (value === null || value === '' || value === 'v2' || value === 'full' || value === 'tutor') {
    return 'v2';
  }
  if (value === 'planner') return 'planner';
  return null;
}
