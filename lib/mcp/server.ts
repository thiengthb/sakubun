import { createMcpHandler } from 'mcp-handler';
import type { McpProfile } from '@/lib/mcp/profiles';
import { registerPlannerTools } from '@/lib/mcp/tools/planner';
import { registerV2Tools } from '@/lib/mcp/tools/v2';
import { HOC_PROMPT } from '@/lib/mcp/v2-prompt';
import { setToolCallRecorder, type McpServer } from '@/lib/mcp/tool-kit';
import { recordToolCall } from '@/lib/mcp/usage';

setToolCallRecorder(recordToolCall);

export function registerAll(server: McpServer, profile: McpProfile): void {
  if (profile === 'planner') {
    registerPlannerTools(server);
    return;
  }
  registerV2Tools(server);
  server.prompt(HOC_PROMPT.name, HOC_PROMPT.description, async () => ({
    messages: [{ role: 'user', content: { type: 'text', text: HOC_PROMPT.text } }],
  }));
}

function handlerFor(profile: McpProfile) {
  return createMcpHandler(
    (server) => registerAll(server, profile),
    { serverInfo: { name: 'sakubun-mcp', version: '0.2.0' } },
    { basePath: '/api', disableSse: true },
  );
}

export const mcpHandlers: Record<McpProfile, (req: Request) => Promise<Response>> = {
  v2: handlerFor('v2'),
  planner: handlerFor('planner'),
};
