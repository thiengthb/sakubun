#!/usr/bin/env node
// Phase 3: one Hán Việt reading PER KANJI (≈2,000), then words are spelled from their kanji
// (確認 → XÁC NHẬN). Per-word guesses by the model were wrong for ~1 in 6 kanji words; a single
// character is a much easier question, and Unihan gives candidates to check it against.
//   LLM_URL=… LLM_KEY=… node scripts/openjlpt/hanviet.mjs
// Reads data/openjlpt/unihan-vi.json (scripts/openjlpt/unihan.py), writes data/openjlpt/hanviet-kanji.json
// { kanji: { reading, source: "agree" | "llm-only" | "disagree", unihan: [...] } } (resumable) and
// data/openjlpt/hanviet-review.md listing every "disagree" for a human to check.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data/openjlpt');
const LLM = process.env.LLM_URL ?? 'http://100.85.167.65:8090/v1/chat/completions';
const KEY = process.env.LLM_KEY;
const MODEL = process.env.MODEL ?? 'gemma4-26b';
const BATCH = 60;

const SYSTEM =
  'Bạn là chuyên gia chữ Hán. Với mỗi chữ kanji (tiếng Nhật), cho ÂM HÁN VIỆT thông dụng nhất của chữ đó, ' +
  'viết thường có dấu (vd 確 → "xác", 曜 → "diệu", 気 → "khí"). Chữ do Nhật tự tạo (quốc tự) không có âm Hán Việt thì trả null. ' +
  'Chỉ trả JSON: {"items":[{"k":"…","hv":"…"|null}]} với đúng các chữ được giao.';

export const norm = (s) => (s ?? '').normalize('NFC').trim().toLowerCase();
const TONES = /[\u0300\u0301\u0303\u0309\u0323]/g;
// Same syllable whatever the tone-mark placement (hoá/hóa) or i/y spelling (kỳ/kì).
export function sameSyllable(a, b) {
  const key = (s) => {
    const d = norm(s).normalize('NFD');
    return [
      d.replace(TONES, '').normalize('NFC').replace(/y/g, 'i'),
      (d.match(TONES) ?? []).sort().join(''),
    ].join('|');
  };
  return !!a && !!b && key(a) === key(b);
}
const isVietnamese = (s) => !!s && /^[a-zà-ỹđ]+$/u.test(norm(s));
export function classify(reading, unihan) {
  if (!isVietnamese(reading)) return 'invalid';
  if (!unihan?.length) return 'llm-only';
  return unihan.some((c) => sameSyllable(reading, c)) ? 'agree' : 'disagree';
}

// Spell a word's Hán Việt from its kanji; null if any kanji has no reading (better nothing than half).
export function spellHanviet(expression, table) {
  const ks = [...expression].filter((c) => /[一-鿿]/.test(c));
  if (ks.length === 0) return null;
  const parts = ks.map((c) => table[c]?.reading ?? null);
  return parts.every(Boolean) ? parts.join(' ').toUpperCase() : null;
}

async function ask(chars) {
  const res = await fetch(LLM, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 4096,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: chars.join(' ') },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const text = (await res.json()).choices[0].message.content ?? '';
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).items ?? [];
}

async function main() {
  if (!KEY) throw new Error('LLM_KEY is not set');
  const unihan = JSON.parse(await readFile(path.join(DIR, 'unihan-vi.json'), 'utf8'));
  const outPath = path.join(DIR, 'hanviet-kanji.json');
  const table = JSON.parse(await readFile(outPath, 'utf8').catch(() => '{}'));
  const todo = Object.keys(unihan).filter((k) => !table[k]);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    let items = [];
    for (let attempt = 1; attempt <= 3 && items.length === 0; attempt++) {
      try {
        items = await ask(batch);
      } catch (e) {
        console.error(`batch ${i / BATCH + 1} attempt ${attempt}: ${e.message}`);
      }
    }
    for (const { k, hv } of items) {
      if (!batch.includes(k)) continue;
      const llm = hv ? norm(hv) : null;
      table[k] = { reading: llm, source: classify(llm, unihan[k]), unihan: unihan[k] ?? [] };
    }
    await writeFile(outPath, JSON.stringify(table, null, 0).replace(/},"/g, '},\n"') + '\n');
    console.log(`${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  for (const v of Object.values(table)) v.source = classify(v.reading, v.unihan);
  await writeFile(outPath, JSON.stringify(table, null, 0).replace(/},"/g, '},\n"') + '\n');
  const bad = Object.entries(table).filter(([, v]) => v.source !== 'agree');
  await writeFile(
    path.join(DIR, 'hanviet-review.md'),
    `# Âm Hán Việt cần xem lại (${bad.length} chữ)\n\nGemma và từ điển Unihan không khớp, hoặc Unihan không có chữ này. ` +
      `Sửa cột "Dùng" nếu sai.\n\n| Chữ | Dùng (Gemma) | Unihan gợi ý | Loại |\n|---|---|---|---|\n` +
      bad
        .map(
          ([k, v]) =>
            `| ${k} | ${v.reading ?? '—'} | ${v.unihan.join(', ') || '—'} | ${v.source} |`,
        )
        .join('\n') +
      '\n',
  );
  const counts = Object.values(table).reduce(
    (m, v) => ((m[v.source] = (m[v.source] ?? 0) + 1), m),
    {},
  );
  console.log(JSON.stringify(counts));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
