# Thẻ enrichment v3 — thước đo theo kind, và từ vựng thôi vô hình

> 2026-08-12 · nhánh `chore/nang-harness-2.29.0` · yêu cầu: "enrich toàn bộ mẫu ngữ pháp đang có, và
> nâng cấp phần enrich của từ vựng — thêm đồng nghĩa trái nghĩa, ví dụ phải có dịch tiếng Việt".

## Điều tìm ra khi đi đọc code, trước khi sửa gì

Cảm giác "enrich của từ vựng yếu kém" **không** phải vì thẻ mỏng. Nó là bốn lỗi tách biệt, mỗi lỗi
đều cắt một đoạn của đường đi từ dữ liệu tới người học. Không lỗi nào bị unit test hay e2e nào bắt,
vì từng hàm đều đúng.

| # | Lỗi | Bằng chứng trong code TRƯỚC khi sửa |
|---|---|---|
| 1 | **Thẻ từ vựng không bao giờ được vẽ ra.** Claude soạn, DB lưu, không màn hình nào đọc. | `item-analytics.tsx`: `stats.kind === 'grammar' ? <EnrichmentCard/> : <hanviet + notes>` · `item-detail-dialog.tsx`: `{kind === 'grammar' && <EnrichmentCard/>}` · `VocabRow` **không có** field `enrichment` |
| 2 | **Thước đo chấm từ vựng bằng chiều của ngữ pháp.** | `scoreEnrichment(raw)` không nhận `kind`; năm chiều là `structure` (từ không có), `contrasts` (mẫu gần nghĩa), … Hệ quả hai đầu: một thẻ từ có đúng một dòng `structure` rác thì đạt `ok`, còn một thẻ có 同義語 + 対義語 + collocations thì `thin` vĩnh viễn |
| 3 | **Không có cửa nào lấy danh sách từ cần làm.** | `list_grammar` có `enriched` + `quality`; `list_vocab` **không có cái nào**. Prompt `enrich_backlog` chỉ gọi `list_grammar` |
| 4 | **Mọi thẻ ghi qua `enrich_items` đều đóng dấu v1 → `outdated` → quay lại trong lượt quét sau.** | `enrichmentSchema` mặc định `v: 1`, và KHÔNG chỗ nào (mô tả tool, prompt) nói cho Claude biết có field `v`. `patch_enrichment` không bị vì `mergeEnrichment` tự đóng dấu — hai đường ghi bất đồng ý với nhau |

Lỗi 4 là lỗi nặng nhất về hệ quả: **tồn đọng không thể giảm.** Soạn xong 20 mẫu, gọi lại
`list_grammar { quality: 'needs-work' }` vẫn trả về đúng 20 mẫu đó.

Ngoài ra, ba chỗ nói ra thành lời niềm tin "từ vựng không có thẻ", và chính niềm tin đó là nguyên nhân:

- `items-table.tsx`: `{/* Riêng của bảng ngữ pháp — từ vựng không có thẻ chi tiết. */}`
- `library-health.ts`: `/** … (vocab cards are not part of the enrichment contract). */`
- `e2e/resources-tables.spec.ts`: `expect(…filter({ hasText: 'Mọi mục' })).toHaveCount(0)` — một test
  **ghim** niềm tin sai lại.

## Đã sửa

**Lược đồ.** `synonyms` / `antonyms` là trường thật, kiểu `{ term, reading?, vi, note? }` — `vi` BẮT
BUỘC, vì một danh sách 同義語 trần là danh sách từ người học chưa đọc được. Không nhét vào `contrasts`:
hình dạng `{ with, note }` đúng cho ngữ pháp (mẫu gần nghĩa là mẫu đang học, không cần nghĩa) và sai
cho từ. `CURRENT_ENRICHMENT_VERSION` 2 → 3.

**Thước đo theo kind.** `scoreEnrichment(raw, kind)` — tham số BẮT BUỘC, không phải optional mặc định
GRAMMAR: một cờ optional là một cờ phải nhớ ở 8 chỗ, cờ bắt buộc buộc compiler đi thăm cả 8.

| | GRAMMAR (không đổi) | VOCAB (mới) |
|---|---|---|
| 1 | cách chia / cách gắn | cách dùng |
| 2 | cách dùng | **ví dụ có dịch tiếng Việt** (≥2, và `vi` không được là khoảng trắng) |
| 3 | ví dụ | **cụm / khung câu hay đi kèm** (≥2) |
| 4 | bẫy hay gặp | **từ đồng nghĩa / trái nghĩa** (≥1) |
| 5 | phân biệt mẫu gần nghĩa | bẫy hay gặp |

**Trái nghĩa cố ý KHÔNG bắt buộc riêng.** 会議, 準備, ほとんど không có 対義語 thật; một chiều đòi nó
là một chiều được thoả bằng cách bịa. Có trái nghĩa được tính vào điểm `rich`.

**`vi` là khoảng trắng thì không tính.** `exampleSchema` đòi `vi` với `min(1)` — một dấu cách thoả
điều kiện đó, parse được, và hiện ra thành một dòng trống dưới câu tiếng Nhật.

**Đóng dấu version ở SERVER.** `saveEnrichments` tự đóng dấu `v` khi thẻ đạt bar của kind đó. Sửa
đúng chỗ: `v` là thuộc tính của ĐỊNH DẠNG do module này định nghĩa, bắt tác giả nhắc lại một con số
họ không kiểm được chính là cách lỗi 4 xảy ra. Thẻ chưa đạt thì KHÔNG đóng dấu — `thin` phải còn đọc
ra là thin.

**Cửa cho từ vựng.** `list_vocab` có `enriched` + `quality`. `enrich_backlog` đổi từ
`enriched: false` sang `quality: 'needs-work'` (đúng cái bộ lọc mà `enrichment-quality.ts` được viết
ra để sửa), và đi cả hai kho. `listItems` trả thêm `card: { tier, missing, v }` để lượt patch nhắm
đúng chỗ thiếu thay vì tự suy ra bằng cách parse thẻ.

**Web.** Thẻ vẽ cho cả hai kind. Hai mục mới «Từ đồng nghĩa» / «Từ trái nghĩa», mỗi từ đi qua
`<SpokenLine>` (luật repo — và ở đây nó có nghĩa cụ thể: nghe được từ đồng nghĩa, có furigana từ
`term` + `reading`), có link sang trang từ đó nếu nó cũng nằm trong kho (`resolveContrastLinks` giờ
phủ cả `synonyms`/`antonyms`, theo đúng kind). Tiêu đề mục đầu đổi theo kind: «Cấu trúc / cách chia»
với mẫu, «Loại từ / khung câu» với từ. Bảng từ vựng có bộ lọc «Thẻ chi tiết» (dùng CHUNG
`lib/card-filter.ts`, không phải bản sao thứ hai). `get_library_health` có dòng «Thẻ từ vựng» riêng.

**Gom một nguồn cho `kind`.** `lib/item-kinds.ts` — bốn bản sao private của `const GRAMMAR_KIND`
(analytics, item-stats, groups, practice) giờ trỏ về một chỗ.

## Lưới gác (mỗi lỗi một phép kiểm tất định)

| Lỗi | Ghim ở | Đã kiểm hai chiều |
|---|---|---|
| Thước đo mù kind | `lib/enrichment-quality.test.ts` — 7 ca, gồm ca "cùng một thẻ, hai kind, hai kết luận" | có: tắt phần chia kind → 6/7 đỏ |
| Thẻ từ vựng vô hình trên web | `e2e/resources-tables.spec.ts` — mở `/resources/v4`, đòi thấy đồng nghĩa + trái nghĩa + hai bản dịch + nút nghe từ đồng nghĩa | có: trả lại `kind === 'grammar'` → đỏ |
| Đóng dấu v1 mãi mãi | `lib/practice.test.ts` — 3 ca, gồm "danh sách cần làm thôi trả về nó" | có: bỏ dòng đóng dấu → 2 ca đỏ |
| `list_vocab` không có cửa | `e2e/mcp-tools.spec.ts` — gọi thật qua HTTP: enrich thẻ từ vựng → `quality: 'needs-work'` không còn chứa nó | — |
| Merge đồng nghĩa/trái nghĩa | `lib/enrichment-merge.test.ts` — 5 ca (trùng, tràn cap, đóng dấu theo kind) | — |
| Dòng «Thẻ từ vựng» | `lib/mcp/render.test.ts` — 3 ca (`renderLibraryHealth` trước đó KHÔNG có test nào) | — |
| Fixture ghim số version | `e2e/resources-tables.spec.ts` import `CURRENT_ENRICHMENT_VERSION` | — |

Fixture đó đã sai vì gõ tay **hai lần**: lần đầu viết `version: 3` (Zod bỏ field lạ), lần sau ghim
`v: 2` rồi bar lên 3. Giờ nó import hằng số.

## Cái giá phải trả, đã đo

`tools/list` phồng lên 56515 byte, vượt trần 56000 của `e2e/mcp-tools.spec.ts`. **Không nâng trần** —
nén mô tả `enrich_items` lại còn vừa. Trần đó tồn tại vì mọi mô tả tool được đọc lại mỗi phiên.

## Việc chưa làm, và vì sao

**Nội dung thật vẫn chưa soạn.** Yêu cầu gốc là "enrich toàn bộ mẫu ngữ pháp đang có" — đó là DỮ LIỆU
trong DB production, và tôi không exec được vào container (classifier chặn). Cần một lệnh CHỈ ĐỌC do
người chạy để lấy bảng `Item` ra JSON; có nó thì soạn được thẻ cho từng mẫu thật và giao lại dưới dạng
file import (đường merge của app, có dry-run).

Nâng định dạng trước là đúng thứ tự: soạn nội dung theo bar cũ rồi nâng bar là soạn hai lần.

**Việc bump v3 làm mọi thẻ hiện có đọc ra là `outdated`.** Đó là cần cẩu được thiết kế để làm đúng
việc này (`enrichment.ts` gọi nó là "the ONE lever"), nhưng nó có nghĩa: lượt quét đầu sau khi deploy
sẽ báo cả kho cần làm lại. Với ngữ pháp thì phần lớn chỉ là đóng dấu lại — `patch_enrichment` đóng dấu
khi thẻ đạt bar, nên một patch nhỏ là đủ, không phải viết lại.
