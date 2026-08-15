import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { zipSync, strToU8 } from 'fflate';

export const DECK_NAME = 'sakubun';
const MODEL_NAME = 'sakubun Basic';

const MODEL_ID = 1752000000000;
const DECK_ID = 1752000000001;
const CRT_SECONDS = 1752000000;

export interface VocabItem {
  word: string;
  reading?: string;
  sinoVietnamese?: string;
  meaning: string;
  example?: string;
  key?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildBack(item: VocabItem): string {
  const lines: string[] = [];
  if (item.reading) lines.push(`【${esc(item.reading)}】`);
  if (item.sinoVietnamese) lines.push(`Âm Hán Việt: ${esc(item.sinoVietnamese)}`);
  lines.push(`Nghĩa: ${esc(item.meaning)}`);
  if (item.example) lines.push(`Ví dụ: ${esc(item.example)}`);
  return lines.join('<br>');
}

const SCHEMA = `
CREATE TABLE col (
  id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null,
  conf text not null, models text not null, decks text not null, dconf text not null, tags text not null
);
CREATE TABLE notes (
  id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null,
  csum integer not null, flags integer not null, data text not null
);
CREATE TABLE cards (
  id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null,
  due integer not null, ivl integer not null, factor integer not null, reps integer not null,
  lapses integer not null, left integer not null, odue integer not null, odid integer not null,
  flags integer not null, data text not null
);
CREATE TABLE revlog (
  id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null,
  type integer not null
);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_cid ON revlog (cid);
CREATE INDEX ix_notes_csum ON notes (csum);
`;

const CARD_CSS = `.card {
  font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
  font-size: 24px;
  text-align: center;
  color: black;
  background-color: white;
}`;

function modelsJson(): string {
  return JSON.stringify({
    [MODEL_ID]: {
      id: MODEL_ID,
      name: MODEL_NAME,
      type: 0,
      mod: CRT_SECONDS,
      usn: -1,
      sortf: 0,
      did: DECK_ID,
      tmpls: [
        {
          name: 'Card 1',
          ord: 0,
          qfmt: '{{Front}}',
          afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
          bqfmt: '',
          bafmt: '',
          did: null,
          bfont: '',
          bsize: 0,
        },
      ],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] },
      ],
      css: CARD_CSS,
      latexPre: '\\documentclass[12pt]{article}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [0]]],
      tags: [],
      vers: [],
    },
  });
}

function decksJson(): string {
  const common = {
    lrnToday: [0, 0],
    revToday: [0, 0],
    newToday: [0, 0],
    timeToday: [0, 0],
    collapsed: false,
    browserCollapsed: true,
    desc: '',
    dyn: 0,
    conf: 1,
    extendNew: 0,
    extendRev: 0,
    usn: -1,
    mod: CRT_SECONDS,
  };
  return JSON.stringify({
    1: { ...common, id: 1, name: 'Default' },
    [DECK_ID]: { ...common, id: DECK_ID, name: DECK_NAME },
  });
}

function confJson(): string {
  return JSON.stringify({
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: 'noteFld',
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: String(MODEL_ID),
    collapseTime: 1200,
  });
}

function dconfJson(): string {
  return JSON.stringify({
    1: {
      id: 1,
      name: 'Default',
      mod: 0,
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: false,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 0],
        order: 1,
        perDay: 20,
      },
      rev: {
        bury: false,
        ease4: 1.3,
        ivlFct: 1,
        maxIvl: 36500,
        perDay: 200,
        hardFactor: 1.2,
      },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
      dyn: false,
      newMix: 0,
      newPerDayMinimum: 0,
      interdayLearningMix: 0,
      reviewOrder: 0,
    },
  });
}

function fieldChecksum(text: string): number {
  return parseInt(createHash('sha1').update(text).digest('hex').slice(0, 8), 16);
}

function noteGuid(item: VocabItem, index: number): string {
  const seed = item.key ?? `${item.word}:${index}`;
  return createHash('sha1').update(seed).digest('base64url').slice(0, 10);
}

export function buildApkg(items: VocabItem[]): Uint8Array {
  const db = new Database(':memory:');
  try {
    db.exec(SCHEMA);

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);

    db.prepare(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`,
    ).run(CRT_SECONDS, nowMs, nowMs, confJson(), modelsJson(), decksJson(), dconfJson());

    const insertNote = db.prepare(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
       VALUES (?, ?, ?, ?, -1, ' sakubun ', ?, ?, ?, 0, '')`,
    );
    const insertCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
    );

    items.forEach((item, i) => {
      const noteId = nowMs + i * 2;
      const cardId = nowMs + i * 2 + 1;
      const front = esc(item.word);
      const flds = `${front}\x1f${buildBack(item)}`;
      insertNote.run(
        noteId,
        noteGuid(item, i),
        MODEL_ID,
        nowSec,
        flds,
        front,
        fieldChecksum(front),
      );
      insertCard.run(cardId, noteId, DECK_ID, nowSec, i + 1);
    });

    const collection = db.serialize();
    return zipSync({
      'collection.anki2': new Uint8Array(collection),
      media: strToU8('{}'),
    });
  } finally {
    db.close();
  }
}
