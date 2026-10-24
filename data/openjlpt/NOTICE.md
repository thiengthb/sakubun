# OpenJLPT data in sakubun

`source.json` (and the Vietnamese meanings derived from it) come from **OpenJLPT** v0.3.0
(https://github.com/evanclan/OpenJLPT, commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`),
licensed **CC BY-SA 4.0**. Changes made here: kept grammar and vocabulary N5–N1, one example per entry,
up to three English meanings per word; Vietnamese meanings and Hán Việt readings added by a language
model and reviewed by the learner. These derived files are shared under the same licence.

OpenJLPT itself builds on:
- JLPT level lists by Jonathan Waller (tanos.co.uk), CC BY
- JMdict / KANJIDIC2 (Electronic Dictionary Research and Development Group), CC BY-SA
- Example sentences from Tatoeba (tatoeba.org), CC BY 2.0 FR

Hán Việt readings per kanji are confirmed against two references (`scripts/openjlpt/hanviet.mjs`):
- Unicode Unihan database (kVietnamese), Unicode License v3
- hanviet-pinyin-words by Phong Phan (https://github.com/ph0ngp/hanviet-pinyin-words), MIT, with the
  shinjitai to kyūjitai table of kyujitai by hakatashi (https://github.com/hakatashi/kyujitai.js), MIT
