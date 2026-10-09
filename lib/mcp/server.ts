import { createMcpHandler } from 'mcp-handler';
import { MCP_PROMPTS } from '@/lib/mcp/prompts';
import { registerContentTools } from '@/lib/mcp/tools/content';
import { registerCoreTools } from '@/lib/mcp/tools/core';
import { registerGroupTools } from '@/lib/mcp/tools/groups';
import { registerLookupTools } from '@/lib/mcp/tools/lookup';
import { registerManageTools } from '@/lib/mcp/tools/manage';
import { registerPracticeTools } from '@/lib/mcp/tools/practice';
import { registerQuizTools } from '@/lib/mcp/tools/quiz';
import { setToolCallRecorder } from '@/lib/mcp/tool-kit';
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
];

export const mcpHandler = createMcpHandler(
  (server) => {
    for (const register of REGISTER_TOOLS) register(server);
    for (const { name, description, text } of MCP_PROMPTS) {
      server.prompt(name, description, async () => ({
        messages: [{ role: 'user', content: { type: 'text', text } }],
      }));
    }
  },
  { serverInfo: { name: 'sakubun-mcp', version: '0.1.0' } },
  { basePath: '/api', disableSse: true },
);
