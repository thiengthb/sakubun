#!/usr/bin/env node
// Phase 3.2: download OpenJLPT at a PINNED commit and normalise it into data/openjlpt/source.json.
// Grammar + vocabulary N5–N1 only (sakubun has no kanji card type yet). Meanings stay English here;
// scripts/openjlpt/translate.mjs adds Vietnamese, the importer reads both.
//   node scripts/openjlpt/fetch.mjs
// OpenJLPT is CC BY-SA 4.0 — see data/openjlpt/NOTICE.md.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const COMMIT = '0d1d3410bec90bd4098a7c72de820543cb4f707c'; // v0.3.0, 2026-10-02
const RAW = `https://raw.githubusercontent.com/evanclan/OpenJLPT/${COMMIT}/data/json`;
const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const OUT = path.join(process.cwd(), 'data/openjlpt/source.json');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// One example is enough for the importer's notes; the tutor writes richer cards later.
const firstExample = (examples) => {
  const e = (examples ?? [])[0];
  return e ? { ja: e.ja, furigana: e.furigana ?? null, en: e.en ?? null } : null;
};

export function normaliseGrammar(rows) {
  return rows.map((g) => ({
    id: `g:${g.id}`,
    expression: g.pattern,
    level: g.level,
    formation: g.formation ?? null,
    meaningEn: g.meaning,
    example: firstExample(g.examples),
  }));
}

export function normaliseVocab(rows) {
  return rows.map((v) => ({
    id: `v:${v.id}`,
    expression: v.word,
    reading: v.reading && v.reading !== v.word ? v.reading : null,
    level: v.level,
    pos: v.pos ?? [],
    meaningEn: (v.meanings ?? []).slice(0, 3).join('; '),
    example: firstExample(v.examples),
  }));
}

async function main() {
  const meta = await getJson(`${RAW}/meta.json`);
  const grammar = [];
  const vocab = [];
  for (const lv of LEVELS) {
    grammar.push(...normaliseGrammar(await getJson(`${RAW}/grammar/${lv}.json`)));
    vocab.push(...normaliseVocab(await getJson(`${RAW}/vocab/${lv}.json`)));
  }
  const want = meta.counts;
  if (grammar.length !== want.grammar.total || vocab.length !== want.vocab.total)
    throw new Error(
      `count mismatch: grammar ${grammar.length}/${want.grammar.total}, vocab ${vocab.length}/${want.vocab.total}`,
    );
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({
      source: 'OpenJLPT',
      version: meta.version,
      commit: COMMIT,
      license: meta.license,
      grammar,
      vocab,
    }) + '\n',
  );
  console.log(
    `grammar ${grammar.length}, vocab ${vocab.length} → ${path.relative(process.cwd(), OUT)}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
