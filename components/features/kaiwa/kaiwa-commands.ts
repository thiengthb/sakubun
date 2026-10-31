// What the learner pastes into Claude to write or change a script; the `kaiwa` MCP prompt does the
// rest (lib/mcp/kaiwa-prompt.ts).
export const WRITE_SCRIPT_COMMAND = 'Soạn kịch bản Kaiwa với sakubun';

export const editScriptCommand = (title: string) => `Sửa kịch bản Kaiwa "${title}" trong sakubun`;

// The AI plays the other parts through kaiwa_roleplay (K8).
export const roleplayCommand = (title: string, part: string) =>
  `Nhập vai kịch bản Kaiwa "${title}" trong sakubun, tôi là ${part}`;
