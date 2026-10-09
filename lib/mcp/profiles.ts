import type { McpServer } from '@/lib/mcp/tool-kit';

// Which tools each MCP client sees. `full` (the default) is every tool, for Claude Desktop / ChatGPT.
// `tutor` is only the learning loop, for a self-hosted model (Hermes on Gemma): the full set's
// definitions are ~17K tokens, which costs a local model both context and first-token latency.
export const TUTOR_TOOLS = [
  'ping',
  'get_protocol',
  'get_settings',
  'get_stats',
  'get_due_items',
  'stage_sentence',
  'submit_review',
  'skip_sentence',
  'check_library',
  'add_vocab',
  'get_quiz_items',
  'get_weak_report',
] as const;

export type McpProfile = 'full' | 'tutor';

// null = not a profile we know; the route answers 400 rather than silently serving the full set.
export function parseProfile(value: string | null): McpProfile | null {
  if (value === null || value === '' || value === 'full') return 'full';
  if (value === 'tutor') return 'tutor';
  return null;
}

// A view of `server` whose tool() drops every tool outside the profile; prompts pass through.
export function restrictToProfile(server: McpServer, profile: McpProfile): McpServer {
  if (profile === 'full') return server;
  const allowed = new Set<string>(TUTOR_TOOLS);
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
