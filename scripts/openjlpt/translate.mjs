#!/usr/bin/env node
// Phase 3.3: Vietnamese meanings (+ Hán Việt for vocab with kanji) for data/openjlpt/source.json,
// written by the self-hosted model on ubuntu-pc (llama-swap, OpenAI-compatible API).
// Resumable: results accumulate in data/openjlpt/vi.json keyed by entry id; rerun to continue.
//   LLM_URL=… LLM_KEY=… node scripts/openjlpt/translate.mjs [--sample 50] [--limit N]
// --sample N picks N spread-out entries (both kinds, all levels) and also writes sample-review.md.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data/openjlpt');
const LLM = process.env.LLM_URL ?? 'http://100.85.167.65:8090/v1/chat/completions';
const KEY = process.env.LLM_KEY;
const MODEL = process.env.MODEL ?? 'gemma4-26b';
const BATCH = 25;

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : null;
};

const SYSTEM =
  'Bạn là người biên soạn từ điển Nhật–Việt cho người Việt học JLPT. Với mỗi mục, viết nghĩa tiếng Việt ' +
  'NGẮN GỌN, tự nhiên, đúng nghĩa thường dùng (tối đa khoảng 12 từ; nhiều nghĩa thì cách nhau bằng "; "). ' +
  'Ngữ pháp: nêu ý nghĩa của mẫu, không dịch máy móc phần tiếng Anh. ' +
  'Từ vựng CÓ kanji: thêm "hanviet" là âm Hán Việt viết HOA từng chữ theo đúng thứ tự kanji (vd 確認 → "XÁC NHẬN"); ' +
  'chữ nào không có âm Hán Việt thông dụng thì bỏ qua chữ đó; từ không có kanji thì hanviet = null. ' +
  'Chỉ trả về JSON: {"items":[{"id":"…","meaningVi":"…","hanviet":"…"|null}]} với ĐÚNG các id được giao.';

const hasKanji = (s) => /[一-鿿]/.test(s);

function promptFor(batch) {
  return batch
    .map((e) =>
      e.id.startsWith('g:')
        ? `- id ${e.id} | NGỮ PHÁP ${e.level} | ${e.expression} | cách nối: ${e.formation ?? '-'} | EN: ${e.meaningEn}`
        : `- id ${e.id} | TỪ VỰNG ${e.level} | ${e.expression}${e.reading ? `（${e.reading}）` : ''} | EN: ${e.meaningEn}`,
    )
    .join('\n');
}

async function translate(batch) {
  const res = await fetch(LLM, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 4096,
      // Gemma 4 thinks by default; thinking ate the whole token budget and left an empty answer.
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: promptFor(batch) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const text = (await res.json()).choices[0].message.content ?? '';
  const items = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).items ?? [];
  const byId = new Map(batch.map((e) => [e.id, e]));
  const out = {};
  for (const it of items) {
    const e = byId.get(it.id);
    if (!e || typeof it.meaningVi !== 'string' || !it.meaningVi.trim()) continue;
    out[it.id] = {
      meaningVi: it.meaningVi.trim(),
      hanviet: e.id.startsWith('v:') && hasKanji(e.expression) && it.hanviet ? String(it.hanviet).trim() : null,
    };
  }
  return out;
}

// Evenly spread pick so the sample covers both kinds and every level.
function spread(entries, n) {
  const step = entries.length / n;
  return Array.from({ length: n }, (_, i) => entries[Math.floor(i * step)]);
}

async function main() {
  if (!KEY) throw new Error('LLM_KEY is not set');
  const src = JSON.parse(await readFile(path.join(DIR, 'source.json'), 'utf8'));
  const viPath = path.join(DIR, 'vi.json');
  const vi = JSON.parse(await readFile(viPath, 'utf8').catch(() => '{}'));
  const all = [...src.grammar, ...src.vocab];
  const sample = arg('--sample');
  let todo = sample
    ? [...spread(src.grammar, Math.round(sample * 0.3)), ...spread(src.vocab, sample - Math.round(sample * 0.3))]
    : all;
  todo = todo.filter((e) => !vi[e.id]);
  const limit = arg('--limit');
  if (limit) todo = todo.slice(0, limit);

  const t0 = Date.now();
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    let got = {};
    for (let attempt = 1; attempt <= 3 && Object.keys(got).length < batch.length; attempt++) {
      try {
        got = { ...got, ...(await translate(batch.filter((e) => !got[e.id]))) };
      } catch (e) {
        console.error(`batch ${i / BATCH + 1} attempt ${attempt}: ${e.message}`);
      }
    }
    Object.assign(vi, got);
    await writeFile(viPath, JSON.stringify(vi, null, 1) + '\n');
    const done = Math.min(i + BATCH, todo.length);
    console.log(`${done}/${todo.length} (${Object.keys(got).length}/${batch.length} ok) · ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  if (sample) {
    const ids = new Set(
      [...spread(src.grammar, Math.round(sample * 0.3)), ...spread(src.vocab, sample - Math.round(sample * 0.3))].map((e) => e.id),
    );
    const rows = all
      .filter((e) => ids.has(e.id))
      .map((e) => {
        const v = vi[e.id];
        return `| ${e.level} | ${e.expression}${e.reading ? `（${e.reading}）` : ''} | ${e.meaningEn} | ${v?.meaningVi ?? '—'} | ${v?.hanviet ?? ''} |`;
      });
    await writeFile(
      path.join(DIR, 'sample-review.md'),
      `# Mẫu ${rows.length} mục để xem lại bản dịch\n\n| Cấp | Mục | Tiếng Anh (gốc) | Tiếng Việt (Gemma) | Hán Việt |\n|---|---|---|---|---|\n${rows.join('\n')}\n`,
    );
  }
}

await main();
