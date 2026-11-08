# Kanji data in sakubun

Built by `scripts/kanji/build.py` (KJ1, `docs/plans/2026-11-08-kanji.md`) for the 2,136 Jōyō kanji.

- **KANJIDIC2** by the Electronic Dictionary Research and Development Group (EDRDG),
  https://www.edrdg.org/wiki/index.php/KANJIDIC_Project, licensed **CC BY-SA 4.0**
  (https://www.edrdg.org/edrdg/licence.html). Read from the SQLite copy in the PyPI package
  `jamdict-data` 1.5. Used: On and Kun readings, stroke counts, Kangxi radical numbers, school grades,
  newspaper frequency, up to three English meanings, and the Vietnamese reading where OpenJLPT has none.
- **KanjiVG** by Ulrich Apel and contributors, https://kanjivg.tagaini.net, tag `r20250816`, licensed
  **CC BY-SA 3.0**. Used: stroke paths in writing order (`strokes.json`), the direct parts of each kanji,
  and the part marked as giving the sound.
- **OpenJLPT** (see `data/openjlpt/NOTICE.md`): the level of a kanji is the easiest level of a word
  written with it, and the Hán Việt reading comes from `data/openjlpt/hanviet-kanji.json`.
- `radicals-vi.json`: the Vietnamese names and short meanings of the 214 Kangxi radicals, written for
  sakubun; the forms of each radical come from Unicode's Kangxi Radicals block (NFKC).

Changes made here: kept the Jōyō kanji only, merged the sources into one row per kanji, kept the path
data without the SVG wrapper. `kanji.json`, `strokes.json` and `radicals.json` are shared under
CC BY-SA 4.0.
