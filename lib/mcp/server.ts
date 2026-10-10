import { createMcpHandler } from 'mcp-handler';
import { MCP_PROMPTS } from '@/lib/mcp/prompts';
import { restrictToProfile, type McpProfile } from '@/lib/mcp/profiles';
import { registerContentTools } from '@/lib/mcp/tools/content';
import { registerCoreTools } from '@/lib/mcp/tools/core';
import { registerGroupTools } from '@/lib/mcp/tools/groups';
import { registerLookupTools } from '@/lib/mcp/tools/lookup';
import { registerManageTools } from '@/lib/mcp/tools/manage';
import { registerPlannerTools } from '@/lib/mcp/tools/planner';
import { registerPracticeTools } from '@/lib/mcp/tools/practice';
import { registerQuizTools } from '@/lib/mcp/tools/quiz';
import { setToolCallRecorder, type McpServer } from '@/lib/mcp/tool-kit';
import { recordToolCall } from '@/lib/mcp/usage';

setToolCallRecorder(recordToolCall);

const REGISTER_TOOLS = [
  registerCoreTools,
  registerContentTools,
  registerPracticeTools,
  registerManageTools,
  registerLookupTools,
  registerQuizTools,
  registerGroupTools,
  registerPlannerTools,
];

export function registerAll(server: McpServer, profile: McpProfile): void {
  const view = restrictToProfile(server, profile);
  for (const register of REGISTER_TOOLS) register(view);
  for (const { name, description, text } of MCP_PROMPTS) {
    server.prompt(name, description, async () => ({
      messages: [{ role: 'user', content: { type: 'text', text } }],
    }));
  }
}

function handlerFor(profile: McpProfile) {
  return createMcpHandler(
    (server) => registerAll(server, profile),
    { serverInfo: { name: 'sakubun-mcp', version: '0.1.0' } },
    { basePath: '/api', disableSse: true },
  );
}

export const mcpHandlers: Record<McpProfile, (req: Request) => Promise<Response>> = {
  full: handlerFor('full'),
  tutor: handlerFor('tutor'),
  planner: handlerFor('planner'),
};
