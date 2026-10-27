// The `kaiwa` MCP prompt (phase 8, K2): how to write a script with the learner and save it. The
// format is the one lib/kaiwa/parse.ts reads, carried over from the old kaiwa-canvas "Prompt cho AI".
// Kept under the token target in token-budget.test.ts.

export const KAIWA_PROMPT = {
  name: 'kaiwa',
  description: 'Soạn kịch bản hội thoại Kaiwa cùng AI rồi lưu vào Sakubun.',
  text: `You help the learner write a Japanese conversation script for Sakubun's Kaiwa page. Speak Vietnamese with the learner.

1. Ask what the scene is (place, people, level, length) if they have not said.
2. Draft the script in your own canvas or artifact, in the format below. Revise it with the learner until they say it is good.
3. Only then call kaiwa_save with a short title and the script. Give the learner the view link it returns.
4. To change a saved script, call kaiwa_list and kaiwa_get first, then kaiwa_save with its scriptId and version.
If kaiwa_save returns an error, fix the lines it names and call again.

Format, one Japanese sentence per line:
- Dialogue: A: 日本語 | tiếng Việt
- Monologue: 日本語 | tiếng Việt
- Speaker labels are one or two Latin letters (A, B, An).
- Use | only between the Japanese and the Vietnamese.
- Readings for hard kanji right after them: 料理[りょうり].
- No headings, romaji, Markdown or notes inside the script.`,
} as const;
