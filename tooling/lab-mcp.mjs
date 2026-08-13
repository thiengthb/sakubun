// Gọi MỘT tool MCP trên phòng lab, đúng đường Claude Desktop đi: JSON-RPC 2.0 qua Streamable HTTP,
// bearer token, STATELESS (server dựng handler với disableSse: true nên không có mcp-session-id).
//
//     node tooling/lab-mcp.mjs --list
//     node tooling/lab-mcp.mjs --prompt practice
//     node tooling/lab-mcp.mjs get_due_items '{}'
//     node tooling/lab-mcp.mjs stage_sentence "$(cat câu.json)"
//
// In NGUYÊN VĂN phần text của kết quả, kể cả khi tool trả lỗi — vì `guard()` biến mọi exception thành
// `isError: true` với HTTP 200, nên chốt vào status code là chốt vào chỗ không có tín hiệu.
import { LAB_MCP_TOKEN, LAB_PORT } from './learning-lab-config.mjs';

const URL_ = `http://localhost:${LAB_PORT}/api/mcp`;
const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${LAB_MCP_TOKEN}`,
};

let id = 1;
async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const body = await res.text();
  const line = body.split('\n').find((l) => l.startsWith('data:'));
  try {
    return JSON.parse(line ? line.slice(5).trim() : body);
  } catch {
    return { httpStatus: res.status, raw: body.slice(0, 800) };
  }
}

await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'learning-lab', version: '0' },
});

const [tool, rawArgs] = process.argv.slice(2);
if (!tool) {
  // stderr, không stdout: mã thoát khác 0 phải có đường ra sống sót qua `| tail`/`| grep`.
  console.error('dùng: node tooling/lab-mcp.mjs <tool> \'<json>\' | --list | --prompt <tên>');
  process.exit(2);
}
if (tool === '--list') {
  const r = await rpc('tools/list', {});
  console.log((r.result?.tools ?? []).map((t) => t.name).join('\n'));
  process.exit(0);
}
if (tool === '--prompt') {
  console.log(JSON.stringify(await rpc('prompts/get', { name: rawArgs, arguments: {} }), null, 2));
  process.exit(0);
}

const out = await rpc('tools/call', { name: tool, arguments: rawArgs ? JSON.parse(rawArgs) : {} });
if (!out.result) {
  console.error('KHÔNG CÓ RESULT:', JSON.stringify(out).slice(0, 1200));
  process.exit(1);
}
if (out.result.isError) console.log('*** isError: true ***');
for (const c of out.result.content ?? []) console.log(c.text ?? JSON.stringify(c));
