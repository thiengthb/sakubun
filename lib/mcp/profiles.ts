import type { McpServer } from '@/lib/mcp/tool-kit';

// Which tools each MCP client sees. `full` (the default) is every tool, for Claude Desktop / ChatGPT.
// `tutor` is only the learning loop, for a self-hosted model (Hermes on Gemma): the full set's
// definitions are ~17K tokens, which costs a local model both context and first-token latency.
export const TUTOR_TOOLS = [
  'ping',
  'get_protocol',
  'get_settings',
  'update_settings',
  'get_stats',
  'get_due_items',
  'stage_sentence',
  'submit_review',
  'skip_sentence',
  'check_library',
  'add_vocab',
  'add_grammar',
  'get_quiz_items',
  'get_weak_report',
] as const;

// `planner` is for a scheduling assistant (e.g. a calendar bot): load COUNTS only, read-only, no item
// content and no learner model. A key whose scope is `planner` can never reach any other profile.
export const PLANNER_TOOLS = ['ping', 'get_review_load'] as const;

// `v2` is the new server-led tool set (roadmap 3.1), served beside the old ones until 3.2 makes it the
// default. It is registered on its own in server.ts, with its own single prompt.
export const V2_TOOLS = [
  'next_turn',
  'stage_turn',
  'grade_turn',
  'skip_turn',
  'lookup',
  'add_items',
  'status',
] as const;

export type McpProfile = 'full' | 'tutor' | 'planner' | 'v2';

const ALLOWED: Record<Exclude<McpProfile, 'full' | 'v2'>, readonly string[]> = {
  tutor: TUTOR_TOOLS,
  planner: PLANNER_TOOLS,
};

// null = not a profile we know; the route answers 400 rather than silently serving the full set.
export function parseProfile(value: string | null): McpProfile | null {
  if (value === null || value === '' || value === 'full') return 'full';
  if (value === 'tutor' || value === 'planner' || value === 'v2') return value;
  return null;
}

// A view of `server` whose tool() drops every tool outside the profile; prompts pass through.
export function restrictToProfile(server: McpServer, profile: McpProfile): McpServer {
  if (profile === 'full' || profile === 'v2') return server;
  const allowed = new Set<string>(ALLOWED[profile]);
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== 'tool') return Reflect.get(target, prop, receiver);
      return (name: string, ...rest: unknown[]) =>
        allowed.has(name)
          ? (target.tool as (...args: unknown[]) => unknown).call(target, name, ...rest)
          : undefined;
    },
  });
}
