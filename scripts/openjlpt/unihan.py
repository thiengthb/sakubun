#!/usr/bin/env python3
"""Phase 3: Hán Việt candidates per kanji from Unicode's Unihan database (kVietnamese).

Japanese shinjitai often lack kVietnamese, so traditional/semantic/Z variants are tried too
(気→氣, 来→來, 図→圖). Unihan lists Sino-Vietnamese AND Nôm readings, so these are CANDIDATES
for hanviet.mjs, not answers. Writes data/openjlpt/unihan-vi.json for the kanji actually used.
    python3 scripts/openjlpt/unihan.py
Unihan: Unicode License v3 (https://www.unicode.org/license.txt).
"""
import io, json, re, urllib.request, zipfile, pathlib

URL = "https://www.unicode.org/Public/16.0.0/ucd/Unihan.zip"
DIR = pathlib.Path("data/openjlpt")


def main():
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(URL, timeout=120).read()))
    vn, var = {}, {}
    for line in z.read("Unihan_Readings.txt").decode("utf-8").splitlines():
        if "\tkVietnamese\t" in line:
            cp, _, v = line.split("\t")
            vn[chr(int(cp[2:], 16))] = v.split()
    for line in z.read("Unihan_Variants.txt").decode("utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cp, key, v = line.split("\t")
        if key in ("kTraditionalVariant", "kSemanticVariant", "kZVariant"):
            var.setdefault(chr(int(cp[2:], 16)), []).extend(chr(int(t, 16)) for t in re.findall(r"U\+([0-9A-F]+)", v))

    src = json.loads((DIR / "source.json").read_text("utf-8"))
    kanji = sorted({c for e in src["vocab"] + src["grammar"] for c in e["expression"] if "一" <= c <= "鿿"})
    out = {}
    for c in kanji:
        cands = list(vn.get(c, []))
        for alt in var.get(c, []):
            cands += [r for r in vn.get(alt, []) if r not in cands]
        out[c] = cands
    (DIR / "unihan-vi.json").write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", "utf-8")
    print(f"{len(kanji)} kanji, {sum(1 for v in out.values() if v)} with candidates")


if __name__ == "__main__":
    main()
