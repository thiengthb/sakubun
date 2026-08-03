// Build an Anki deck package (.apkg) from the learner's vocabulary, server-side, for download.
//
// WHY a file and not a live push: the previous bridge (lib/anki.ts, removed 2026-07-23) POSTed to
// AnkiConnect at host.docker.internal:8765 — i.e. the Anki running on the machine that hosts the
// CONTAINER. That can only ever reach one Anki, so on a multi-user deploy every member's vocab would
// land in the operator's collection (or fail). A downloaded .apkg is imported by each member into
// THEIR OWN Anki: no AnkiConnect, no 0.0.0.0 rebind, no "keep Anki open".
//
// FORMAT (legacy, frozen — every modern Anki still imports it): a ZIP containing
//   collection.anki2  a SQLite DB with 5 tables (col, notes, cards, revlog, graves)
//   media             a JSON map of media files; "{}" because these cards carry no audio/images
// The `col` row stores note types + decks as JSON blobs rather than tables. Built with better-sqlite3
// (already a dependency via the Prisma adapter) so we do not pull a second SQLite engine, and zipped
// with fflate (MIT, zero-dependency).

import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { zipSync, strToU8 } from 'fflate';

export const DECK_NAME = 'sakubun';
const MODEL_NAME = 'sakubun Basic';

// Anki identifies decks/note types by integer id. These are FIXED (not Date.now()) so that every
// export produces the same deck + note type: re-importing an updated file then merges into the same
// deck instead of creating "sakubun-2", "sakubun-3", ...
const MODEL_ID = 1752000000000;
const DECK_ID = 1752000000001;
// Collection creation time (seconds). Fixed for the same reason — it only anchors the scheduler's day.
const CRT_SECONDS = 1752000000;

export interface VocabItem {
  /** The word as it appears (kanji/kana) — becomes the card Front. */
  word: string;
  reading?: string;
  /** Am Han Viet — the Sino-Vietnamese reading, a strong mnemonic for VN learners. */
  sinoVietnamese?: string;
  meaning: string;
  /** Example sentence (e.g. the sentence the word appeared in) for context. */
  example?: string;
  /**
   * Stable per-item key (the sakubun Item id). Anki dedupes on a note's `guid`, so deriving the guid
   * from this makes a re-export UPDATE the existing note instead of adding a duplicate.
   */
  key?: string;
}

/** Anki fields are HTML — escape user/model content so a stray &, < or > can't break the card. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Back-of-card HTML: cach doc / am Han Viet / nghia / vi du — each line only when present. */
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

/** Two fields, one template — the shape of Anki's stock "Basic" note type. */
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
      // "template 0 produces a card whenever field 0 is non-empty" — without this Anki generates no cards.
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
    // Anki expects the Default deck (id 1) to exist in every collection.
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

/** Anki's duplicate check reads this: the first 8 hex digits of sha1(first field), as an integer. */
function fieldChecksum(text: string): number {
  return parseInt(createHash('sha1').update(text).digest('hex').slice(0, 8), 16);
}

/** A stable, Anki-legal note guid derived from the item key (falls back to the word itself). */
function noteGuid(item: VocabItem, index: number): string {
  const seed = item.key ?? `${item.word}:${index}`;
  return createHash('sha1').update(seed).digest('base64url').slice(0, 10);
}

/**
 * Build a complete .apkg for the given vocabulary. Returns the raw ZIP bytes, ready to stream as a
 * download. Cards are created as NEW (no scheduling carried over) — sakubun owns its own FSRS state
 * and deliberately does not export it; Anki schedules its copy independently.
 */
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
      // Ids must be unique integers; Anki conventionally uses epoch-ms, so offset by the index.
      const noteId = nowMs + i * 2;
      const cardId = nowMs + i * 2 + 1;
      const front = esc(item.word);
      // Fields are joined by the 0x1f unit separator inside a single `flds` column.
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
      // `due` is the new-card queue position, so cards come out in the order given.
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
