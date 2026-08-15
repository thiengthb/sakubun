// Minimal MCP client: initialize once, then call tools/prompts like Claude Desktop would.
const URL = 'http://localhost:3801/api/mcp';
const TOKEN = 'sim-mcp-token-0123456789';
let id = 0;

async function rpc(method, params) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const body = await res.text();
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  const json = JSON.parse(line ? line.slice(5).trim() : body);
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

export async function init() {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'claude-desktop-sim', version: '1.0' },
  });
}
export const listTools = () => rpc('tools/list', {});
export const listPrompts = () => rpc('prompts/list', {});
export const getPrompt = (name) => rpc('prompts/get', { name });
export async function call(name, args = {}) {
  const r = await rpc('tools/call', { name, arguments: args });
  return r.content?.map((c) => c.text).join('\n') ?? JSON.stringify(r);
}
