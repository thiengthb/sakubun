import type { createMcpHandler } from 'mcp-handler';
import { ZodError } from 'zod';

export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

export function mcpError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

function recordNotFoundModel(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  if (!('code' in e) || e.code !== 'P2025') return null;
  const meta: unknown = 'meta' in e ? e.meta : null;
  const model =
    typeof meta === 'object' && meta !== null && 'modelName' in meta
      ? (meta as { modelName: unknown }).modelName
      : null;
  return typeof model === 'string' ? model : '';
}

function recordNotFoundMessage(model: string): string {
  switch (model) {
    case 'Item':
    case 'SrsState':
      return 'Unknown itemId (deleted or mistyped). Call lookup or next_turn for a current one.';
    case 'Turn':
      return 'Unknown turnId. Call next_turn, then stage_turn.';
    default:
      return (
        `Lỗi phía server: thiếu một hàng ${model || '(không rõ bảng)'} trong cơ sở dữ liệu. ` +
        'KHÔNG phải do id bạn gửi, nên gọi lại với id khác cũng không giúp được gì — ĐỪNG thử lại lời gọi này. ' +
        'Nói với người học rằng lần ghi vừa rồi thất bại và họ cần kiểm log của app.'
      );
  }
}

type ToolCallRecorder = (name: string, ms: number, error: string | null) => Promise<void>;

let recorder: ToolCallRecorder | null = null;

export function setToolCallRecorder(fn: ToolCallRecorder | null): void {
  recorder = fn;
}

async function count(name: string, ms: number, error: string | null): Promise<void> {
  if (!recorder) return;
  try {
    await recorder(name, ms, error);
  } catch (e) {
    console.error(`[mcp] tool=${name} usage-write-failed`, e);
  }
}

const DIGEST_CHARS = 300;

function tail(text: string, room: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= room ? flat : `…${flat.slice(flat.length - room + 1)}`;
}

function errorDigest(e: unknown): string {
  if (e instanceof ZodError) {
    const issues = e.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`).join(' · ');
    return `[ZodError] ${tail(issues, DIGEST_CHARS - 11)}`;
  }

  const raw = e instanceof Error ? e.message : String(e);
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : null;
  if (code === null) return tail(raw, DIGEST_CHARS);

  const model = recordNotFoundModel(e);
  const tag = `[${code}${model ? ` ${model}` : ''}] `;
  const lastLine =
    raw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .at(-1) ?? raw;
  return tag + tail(lastLine, DIGEST_CHARS - tag.length);
}

export function guard<Args extends unknown[], R>(name: string, fn: (...args: Args) => Promise<R>) {
  return async (...args: Args) => {
    const start = Date.now();
    try {
      const res = await fn(...args);
      console.error(`[mcp] tool=${name} ms=${Date.now() - start}`);
      await count(name, Date.now() - start, null);
      return res;
    } catch (e) {
      console.error(`[mcp] tool=${name} error`, e);
      await count(name, Date.now() - start, errorDigest(e));
      if (e instanceof ZodError) {
        const lines = e.issues
          .map((i) => `- ${i.path.join('.') || '(gốc)'}: ${i.message}`)
          .join('\n');
        return mcpError(`Tham số không hợp lệ:\n${lines}`);
      }
      const missingModel = recordNotFoundModel(e);
      if (missingModel !== null) return mcpError(recordNotFoundMessage(missingModel));
      return mcpError(e instanceof Error ? e.message : String(e));
    }
  };
}
