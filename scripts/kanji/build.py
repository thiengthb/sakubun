#!/usr/bin/env python3
"""KJ1: build the kanji data (docs/plans/2026-11-08-kanji.md) for the 2,136 Jōyō kanji.

    python3 scripts/kanji/build.py <path to jamdict.db>

Sources, each pinned:
- KANJIDIC2 (EDRDG, CC BY-SA 4.0), read from the SQLite copy in the PyPI package jamdict-data 1.5
  (`pip download --no-deps jamdict-data==1.5`, then `xz -d jamdict_data/jamdict.db.xz`). Jōyō = grades
  1-6 (kyōiku) and 8 (the rest of the 2010 list).
- KanjiVG (CC BY-SA 3.0), tag KANJIVG_TAG: strokes in order (centre lines) and the component tree.
- data/openjlpt/: the level of a kanji is the easiest level of an OpenJLPT word written with it; the
  Hán Việt reading comes from hanviet-kanji.json, else KANJIDIC2's own Vietnamese reading.

Writes data/kanji/kanji.json (one row per kanji), data/kanji/strokes.json (path data per kanji) and
data/kanji/radicals.json (the 214 radicals of radicals-vi.json with stroke counts).
Fetched SVGs are cached in $KANJIVG_CACHE (default /tmp/kanjivg-<tag>) so a rerun is offline.
"""
import json, os, pathlib, re, sqlite3, sys, urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

KANJIVG_TAG = "r20250816"
KANJIVG_RAW = f"https://raw.githubusercontent.com/KanjiVG/kanjivg/{KANJIVG_TAG}/kanji"
KVG = "{http://kanjivg.tagaini.net}"
SVG = "{http://www.w3.org/2000/svg}"
LEVELS = ["N5", "N4", "N3", "N2", "N1"]
JOYO_GRADES = {"1", "2", "3", "4", "5", "6", "8"}
OUT = pathlib.Path("data/kanji")
OPENJLPT = pathlib.Path("data/openjlpt")


def kanjidic(db_path):
    c = sqlite3.connect(db_path)
    rows = {}
    for cid, lit, strokes, grade, freq in c.execute(
        "select id, literal, stroke_count, grade, freq from character"
    ):
        if grade not in JOYO_GRADES:
            continue
        rows[cid] = {
            "kanji": lit,
            "strokes": strokes,
            "grade": int(grade),
            "freq": int(freq) if freq else None,
            "radical": None,
            "on": [],
            "kun": [],
            "vi": [],
            "meaningEn": [],
        }
    for cid, value in c.execute("select cid, value from radical where rad_type = 'classical'"):
        if cid in rows:
            rows[cid]["radical"] = int(value)
    q = "select g.cid, r.r_type, r.value from reading r join rm_group g on r.gid = g.id"
    for cid, kind, value in c.execute(q):
        row = rows.get(cid)
        key = {"ja_on": "on", "ja_kun": "kun", "vietnam": "vi"}.get(kind)
        if row and key and value not in row[key]:
            row[key].append(value)
    q = "select g.cid, m.value from meaning m join rm_group g on m.gid = g.id where m.m_lang in ('', 'en')"
    for cid, value in c.execute(q):
        row = rows.get(cid)
        if row and len(row["meaningEn"]) < 3:
            row["meaningEn"].append(value)
    return {r["kanji"]: r for r in rows.values()}


def fetch(kanji):
    cache = pathlib.Path(os.environ.get("KANJIVG_CACHE", f"/tmp/kanjivg-{KANJIVG_TAG}"))
    cache.mkdir(parents=True, exist_ok=True)
    name = f"{ord(kanji):05x}.svg"
    path = cache / name
    if not path.exists():
        try:
            with urllib.request.urlopen(f"{KANJIVG_RAW}/{name}", timeout=60) as res:
                path.write_bytes(res.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return kanji, None
            raise
    return kanji, path.read_text("utf-8")


def strip_doctype(text):
    # ElementTree does not read the internal DTD subset KanjiVG declares, which is also where older
    # files bind the kvg: prefix. Drop it and bind the prefix on <svg> to one namespace.
    start = text.find("<!DOCTYPE")
    if start >= 0:
        text = text[:start] + text[text.find("]>", start) + 2 :]
    text = re.sub(r'\sxmlns:kvg="[^"]*"', "", text)
    return text.replace("<svg ", '<svg xmlns:kvg="http://kanjivg.tagaini.net" ', 1)


def parse_kanjivg(kanji, text):
    root = ET.fromstring(strip_doctype(text))
    strokes = [p.get("d") for p in root.iter(f"{SVG}path")]
    top = root.find(f".//{SVG}g[@id='kvg:{ord(kanji):05x}']")

    def element(g):
        return g.get(f"{KVG}element")

    # The direct parts: the first groups below the kanji that name an element. A part split in two
    # (kvg:part 1 and 2, like 衣 around another part) is listed once.
    parts, phon = [], None

    def walk(g, depth):
        nonlocal phon
        for child in g.findall(f"{SVG}g"):
            name = element(child)
            if name and name != kanji:
                if depth == 0 and name not in parts:
                    parts.append(name)
                if child.get(f"{KVG}phon") and phon is None:
                    phon = name
                walk(child, depth + 1)
            else:
                walk(child, depth)

    walk(top, 0)
    return strokes, parts, phon


def radicals(db_path, rows):
    """data/kanji/radicals-vi.json (hand-written names, reviewed by thien) plus each radical's stroke
    count from KANJIDIC2 and how many Jōyō kanji carry it."""
    named = json.loads((OUT / "radicals-vi.json").read_text("utf-8"))
    c = sqlite3.connect(db_path)
    strokes = dict(c.execute("select literal, stroke_count from character"))
    count = {}
    for r in rows:
        count[r["radical"]] = count.get(r["radical"], 0) + 1
    return [
        {
            **r,
            # KANJIDIC2 has 戶 and 靑 only in their Japanese forms 戸 and 青, listed as variants.
            "strokes": strokes.get(r["radical"]) or strokes.get(next(iter(r["variants"]), "")),
            "joyo": count.get(r["number"], 0),
        }
        for r in named
    ]


def levels_by_kanji():
    src = json.loads((OPENJLPT / "source.json").read_text("utf-8"))
    best = {}
    for word in src["vocab"]:
        rank = LEVELS.index(word["level"])
        for ch in word["expression"]:
            if "一" <= ch <= "鿿" and rank < best.get(ch, 99):
                best[ch] = rank
    return {k: LEVELS[v] for k, v in best.items()}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    dic = kanjidic(sys.argv[1])
    hanviet = json.loads((OPENJLPT / "hanviet-kanji.json").read_text("utf-8"))
    levels = levels_by_kanji()
    with ThreadPoolExecutor(16) as pool:
        svgs = dict(pool.map(fetch, sorted(dic)))

    rows, strokes, missing = [], {}, []
    for kanji in sorted(dic, key=ord):
        d = dic[kanji]
        text = svgs.get(kanji)
        if text is None:
            missing.append(kanji)
            paths, parts, phon = [], [], None
        else:
            paths, parts, phon = parse_kanjivg(kanji, text)
            strokes[kanji] = paths
        hv = hanviet.get(kanji, {}).get("reading")
        rows.append(
            {
                "kanji": kanji,
                "hanviet": hv or (d["vi"][0].lower() if d["vi"] else None),
                "hanvietSource": "openjlpt" if hv else ("kanjidic2" if d["vi"] else None),
                "level": levels.get(kanji),
                "grade": d["grade"],
                "freq": d["freq"],
                "strokes": d["strokes"],
                "radical": d["radical"],
                "parts": parts,
                "phon": phon,
                "on": d["on"],
                "kun": d["kun"],
                "meaningEn": d["meaningEn"],
            }
        )
        if paths and d["strokes"] and len(paths) != d["strokes"]:
            rows[-1]["strokeCountNote"] = f"KanjiVG {len(paths)}, KANJIDIC2 {d['strokes']}"

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "kanji.json").write_text(
        "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n", "utf-8"
    )
    (OUT / "strokes.json").write_text(json.dumps(strokes, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8")
    rads = radicals(sys.argv[1], rows)
    (OUT / "radicals.json").write_text(
        "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in rads) + "\n]\n", "utf-8"
    )
    print(f"radicals without a stroke count: {[r['radical'] for r in rads if not r['strokes']]}")
    print(f"{len(rows)} kanji, {len(strokes)} with strokes, missing in KanjiVG: {''.join(missing) or 'none'}")
    print(f"no level: {sum(1 for r in rows if not r['level'])}, no Hán Việt: {sum(1 for r in rows if not r['hanviet'])}")
    print(f"stroke count differs: {sum(1 for r in rows if 'strokeCountNote' in r)}")


if __name__ == "__main__":
    main()
