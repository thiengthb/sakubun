import { createMcpHandler } from 'mcp-handler';
import type { McpProfile } from '@/lib/mcp/profiles';
import { registerPlannerTools } from '@/lib/mcp/tools/planner';
import { registerKaiwaTools } from '@/lib/mcp/tools/kaiwa';
import { registerV2Tools } from '@/lib/mcp/tools/v2';
import { KAIWA_PROMPT } from '@/lib/mcp/kaiwa-prompt';
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
  registerKaiwaTools(server);
  for (const prompt of [HOC_PROMPT, KAIWA_PROMPT]) {
    server.prompt(prompt.name, prompt.description, async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: prompt.text } }],
    }));
  }
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
