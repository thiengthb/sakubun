import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { unzipSync, strFromU8 } from 'fflate';
import { buildApkg, buildBack, DECK_NAME, type VocabItem } from '@/lib/anki-apkg';

const WORD: VocabItem = {
  word: '勉強',
  reading: 'べんきょう',
  sinoVietnamese: 'MIỄN CƯỜNG',
  meaning: 'học tập',
  example: '毎日勉強する。',
  key: 'item-1',
};
const CAT: VocabItem = { word: '猫', meaning: 'con mèo', key: 'item-2' };

/** Unpack a generated .apkg and open its collection so tests assert the REAL file, not our inputs. */
function openApkg(items: VocabItem[]) {
  const files = unzipSync(buildApkg(items));
  const db = new Database(Buffer.from(files['collection.anki2']));
  return { files, db };
}

describe('buildBack', () => {
  it('joins present lines only, in reading/âm Hán Việt/nghĩa/ví dụ order', () => {
    expect(buildBack(WORD)).toBe(
      '【べんきょう】<br>Âm Hán Việt: MIỄN CƯỜNG<br>Nghĩa: học tập<br>Ví dụ: 毎日勉強する。',
    );
  });

  it('omits optional lines and keeps nghĩa', () => {
    expect(buildBack({ word: '猫', meaning: 'con mèo' })).toBe('Nghĩa: con mèo');
  });

  it('escapes HTML so content cannot break the card', () => {
    expect(buildBack({ word: 'x', meaning: 'a < b & c' })).toBe('Nghĩa: a &lt; b &amp; c');
  });
});

describe('buildApkg', () => {
  it('produces a zip holding collection.anki2 plus the media map', () => {
    const { files } = openApkg([WORD]);
    expect(Object.keys(files).sort()).toEqual(['collection.anki2', 'media']);
    expect(strFromU8(files['media'])).toBe('{}');
  });

  it('writes the five Anki tables and one col row', () => {
    const { db } = openApkg([WORD]);
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(['cards', 'col', 'graves', 'notes', 'revlog']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM col').get()).toEqual({ n: 1 });
    db.close();
  });

  it('declares the sakubun deck and a two-field note type that generates a card', () => {
    const { db } = openApkg([WORD]);
    const col = db.prepare('SELECT models, decks FROM col').get() as {
      models: string;
      decks: string;
    };
    const model = Object.values(JSON.parse(col.models))[0] as {
      flds: { name: string }[];
      tmpls: unknown[];
      req: unknown[];
    };
    expect(model.flds.map((f) => f.name)).toEqual(['Front', 'Back']);
    expect(model.tmpls).toHaveLength(1);
    // Without a `req` entry Anki imports the notes but generates zero cards — nothing to review.
    expect(model.req).toEqual([[0, 'any', [0]]]);

    const deckNames = Object.values(JSON.parse(col.decks)).map((d) => (d as { name: string }).name);
    expect(deckNames).toContain(DECK_NAME);
    db.close();
  });

  it('creates one note and one new card per word, in order', () => {
    const { db } = openApkg([WORD, CAT]);
    const notes = db.prepare('SELECT flds, sfld, guid FROM notes ORDER BY id').all() as {
      flds: string;
      sfld: string;
      guid: string;
    }[];
    expect(notes).toHaveLength(2);

    const [front, back] = notes[0].flds.split('\x1f');
    expect(front).toBe('勉強');
    expect(back).toBe(buildBack(WORD));
    expect(notes[0].sfld).toBe('勉強');
    expect(notes[0].guid).not.toBe(notes[1].guid);

    const cards = db
      .prepare('SELECT nid, did, ord, type, queue, due FROM cards ORDER BY due')
      .all();
    expect(cards).toHaveLength(2);
    // type/queue 0 = a NEW card: sakubun keeps its own FSRS state and exports no scheduling.
    expect(cards[0]).toMatchObject({ ord: 0, type: 0, queue: 0, due: 1 });
    db.close();
  });

  it('derives a stable guid from the item key so re-importing updates instead of duplicating', () => {
    const first = openApkg([WORD]);
    const second = openApkg([WORD]);
    const guidOf = (db: Database.Database) =>
      (db.prepare('SELECT guid FROM notes').get() as { guid: string }).guid;
    expect(guidOf(first.db)).toBe(guidOf(second.db));
    first.db.close();
    second.db.close();
  });

  it('escapes HTML in the front field and checksums it for Anki dedupe', () => {
    const { db } = openApkg([{ word: 'a<b&c', meaning: 'x', key: 'k' }]);
    const note = db.prepare('SELECT flds, csum FROM notes').get() as {
      flds: string;
      csum: number;
    };
    expect(note.flds.split('\x1f')[0]).toBe('a&lt;b&amp;c');
    expect(Number.isInteger(note.csum)).toBe(true);
    db.close();
  });

  it('handles an empty vocabulary without producing a broken collection', () => {
    const { db } = openApkg([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM col').get()).toEqual({ n: 1 });
    db.close();
  });
});
