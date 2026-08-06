# optimize-sweep — rà soát code thừa / boilerplate / reuse, và quy trình để nó không quay lại

owner: @thi3n · branch: main · worktree: repo chính · platforms trong scope: web

<!--
  APPEND-ONLY. Xem docs/progress/_TEMPLATE.md.
  ĐIỀU KIỆN THOÁT của chính file này: khi Vòng 0–5 dưới đây đã xong và ba detector ở Vòng 0
  đã vào tooling/ + có baseline, file này thành lịch sử. Đừng biến nó thành checklist sống mãi.
-->

## 2026-08-06 22:10 (session 1, Claude) — ĐO, chưa sửa gì

Theo `.claude/skills/dedupe-scan` (đo baseline trước) và `.claude/skills/entropy-sweep`
(“Báo cáo — KHÔNG TỰ XOÁ. Người quyết định.”). Chưa xoá một dòng nào.

### Baseline (số để lần sau so)

| Vùng | File | Dòng |
|---|---|---|
| `components/` | 135 | 21 140 |
| `lib/` (trừ generated) | 124 | 23 021 |
| `app/` | 48 | 3 145 |
| `tooling/` | 49 | 8 776 |
| `.claude/` | 42 | 3 265 |
| `docs/` | 25 | 2 581 |
| `e2e/` | 9 | 1 401 |

**Trùng lặp (jscpd, min 12 dòng / 70 token, bỏ test + generated): 1.02%** — 461/45 206 dòng,
17 clone. tsx riêng 1.6%. Đây là con số **thấp**: repo này không phải bãi boilerplate, nên
“rà soát code thừa” trả về ít hơn kỳ vọng, và phần lớn giá trị nằm ở nhóm D bên dưới chứ
không phải ở việc gom code.

`node tooling/harness-size.mjs`: mọi mục OK trừ **AGENTS.md 154 dòng (ngưỡng 150)** và
**chưa từng ghi baseline** — nên “harness phình hay co” hiện là CHƯA ĐO ĐƯỢC.

### A — Trùng lặp thật, có thể gom

| # | Chỗ | Kích cỡ | Loại (theo dedupe-scan) | Ghi chú |
|---|---|---|---|---|
| A1 | `components/resources/items-table.tsx` ↔ `vocab-table.tsx` | **11/17 clone**, gồm một khối 92 dòng và một khối 86 dòng; hai file 495 + 563 dòng | 2 — Renamed | Cùng một bảng, khác cột. Đây là món reuse lớn nhất repo. |
| A2 | `lib/analytics.ts:284` ↔ `lib/stats.ts:124` | 29 dòng / 393 token | 2 | Clone TypeScript lớn nhất. |
| A3 | `<FilterRow><Select>` lặp: `history-filters` ↔ `items-table` ↔ `vocab-table` | 3 clone, ~15 dòng mỗi cái | 1 — Exact | Đúng ca “config block lặp” → một `<SelectFilterRow>`. |
| A4 | Khối footer `DataPagination`: `groups-view` ↔ `history-list` | 17 dòng | 1 | |
| A5 | Popover cài đặt của deck: `group-flashcards` ↔ `history-flashcards` | 17 dòng | 2 | **Do chính tôi tạo ra hôm nay** (commit 7f955bc). Ghi ra để không giả vờ nó có sẵn. |
| A6 | `components/shared/data-table.tsx` ↔ `components/shared/use-session-state.ts` | 10 cửa sổ | 2 | **Thêm ở Vòng 0, do công cụ tìm ra chứ không phải tôi.** `data-table.tsx` tự chứa một BẢN SAO RIÊNG của cả cơ chế persistence (`readPersisted`, `writeUrl`, sessionStorage + mirror URL) đã có trong `use-session-state.ts`. Nguy hơn trùng lặp thường: hai bản phải khớp nhau về định dạng key và cách serialize URL, lệch một cái là hai bề mặt âm thầm không thấy state của nhau. |

**Câu hỏi vàng đã hỏi cho từng cặp** (“hai chỗ này sẽ đổi CÙNG NHAU hay ĐỘC LẬP?”):
A1/A3/A4/A5 đổi cùng nhau (cùng một khái niệm UI) → gom được. A2 cần đọc kỹ trước: analytics
và stats có thể là hai câu hỏi khác nhau tình cờ tính giống nhau — nếu vậy thì **GIỮ NGUYÊN
và ghi lý do vào file**, vì abstraction sai tệ hơn duplication.

### B — Code chết (đo bằng TS compiler API, không phải grep)

| # | Thứ | Bằng chứng |
|---|---|---|
| B1 | `components/shared/motion-primitives.tsx` — **cả file**, 84 dòng (`Reveal`, `StaggerGroup`, `StaggerItem`, `fadeUp`, `staggerContainer`) | 0 file nào import. Nó phục vụ trang landing, mà `components/landing/` **không còn tồn tại**. |
| B2 | `components/ui/scroll-area.tsx` | Primitive shadcn không ai dùng (grep: 0 importer). **`dead-exports.mjs` cố ý KHÔNG báo cái này** — nó loại cả `components/ui/**` vì đó là bề mặt vendored, thiếu một nửa mới là lỗi. Nên món này là phán đoán của người, không phải phát hiện của máy: `scroll-area` khác các re-export lẻ ở chỗ **cả file** không ai dùng, và `npx shadcn add scroll-area` lấy lại trong 10 giây. |
| B3 | `app/actions.ts → skipSentenceAction` | Toàn repo có **1** lần nhắc tên: chính dòng định nghĩa. Một server action không ai gọi. |
| B4 | `lib/mcp/tool-kit.ts → getUserId` | 3 lần nhắc: định nghĩa + 2 **comment nói rằng nó đã hết việc** (`lib/mcp/tools/groups.ts:10` ghi rõ “gone from this import on purpose”). |
| B5 | `lib/practice.ts → listCalibrationProposals`, `setProposalVerdict` | Chỉ test gọi. Proposal được GHI (`practice.ts:870`) và hiện cho Claude ở chế độ shadow, nhưng **nửa để người xem/duyệt không có đường vào** — không UI, không MCP tool. |
| B6 | `lib/type-scale.test.ts` → allowlist `'components/landing/'` | Trỏ vào thư mục đã xoá. |
| B7 | **137 export** chỉ dùng trong chính file nó, ở 54 file (`hashToken`, `GuideWalkthrough`, `BulkGroupButton`, `SentenceCardShell`, `SentenceMeta`, `activeFilterCount`, …) | Không phải code chết — là `export` thừa. Bỏ `export`, giữ code. Số đúng là 137, **không phải “~40”** như bản đầu của báo cáo này đoán: con số thật chỉ có sau khi `tooling/dead-exports.mjs` tính e2e vào phía NGƯỜI DÙNG và loại `components/ui/**` khỏi phía bị đo. Và 137 là **danh sách ứng viên, không phải bản án**: nhiều cái là export KIỂU (`Filters`, `PagedList`, `DataTableProps`) — bỏ `export` của một type thuộc bề mặt công khai của module không hiển nhiên là đúng. Xét từng cái. |

### C — Dependency

| # | Gói | Vấn đề |
|---|---|---|
| C1 | `shadcn@^4.16.1` nằm trong **`dependencies`** | Là CLI (`npx shadcn add`), không file nào import. 6.4 MB trong `node_modules`. Dockerfile chạy `npm ci` (không `--omit=dev`) nên nó vào cả image 481 MB. → `devDependencies`, hoặc bỏ hẳn và dùng `npx`. |
| C2 | `@modelcontextprotocol/sdk` | Khai trong `dependencies`, **không file nào import**. Chạy được vì `mcp-handler` kéo theo. Phantom dep. |
| C3 | `@eslint/js` | Khai trong `devDependencies`, `eslint.config.mjs` không import. |

Đã kiểm và **giữ**: `react-dom`, `@prisma/client`, mọi `@types/*` — framework/tsc dùng ngầm.

### D — Tài liệu trỏ vào chỗ không có (nhóm nguy hiểm nhất, và rẻ nhất để sửa)

Với agent, **mọi text trong repo có thẩm quyền như nhau**. Một đường dẫn chết không báo lỗi —
nó gửi người đọc tới chỗ trống, và người đọc sẽ **tự nghĩ ra** nội dung đáng lẽ ở đó.

| # | Thứ | Bằng chứng |
|---|---|---|
| D1 | **16 chỗ trong SOURCE trỏ vào `docs/plans/*`** — 5 file kế hoạch khác nhau (deep-learning-loop, study-groups, conversation-mode, adaptive-calibration, agentic-tutor-loop) | `git log --all -- docs/plans` **trống**: thư mục đó **chưa bao giờ được commit**. Ví dụ `lib/mcp/tool-kit.ts:136` viết “See docs/plans/2026-07-26-adaptive-calibration.md §3”. |
| D2 | `docs/00-map.md`, `docs/decisions.md` | Được source nhắc tên, không tồn tại. |
| D3 | `README.md` **không tồn tại** | Nhưng bảng “Đọc thêm” của AGENTS.md gửi người ta tới nó cho việc “Áp harness lên project mới”. |
| D4 | `.mcp.json` **không tồn tại** | Nhưng AGENTS.md liệt nó vào danh sách **KHÔNG SỬA**, và 3 doc/skill khác cũng nhắc. |
| D5 | `feature_list.json` | `docs/CONFLICTS.md` + `docs/adr/harness/0001` nhắc tên cũ; tên thật là `features/_index.json`. |
| D6 | `docs/progress/_TEAM.md` → `docs/adr/0001-harness-baseline.md` | Đường thật là `docs/adr/harness/0001-harness-baseline.md`. |
| D7 | 13/14 `docs/*.md` không có dòng `last-verified` | entropy-sweep §7 yêu cầu. `docStaleDays` = 90; mọi doc sửa 2026-08-04 nên **chưa** quá hạn — đây là thiếu công cụ đo, không phải doc mục. |

**Không tính là lỗi** (đã kiểm, là lịch sử hoặc có điều kiện): mọi đường dẫn chết trong
`HARNESS-CHANGELOG.md` và `.claude/learnings/**` (changelog và bài học **phải** nhắc file đã
đổi tên — đó là việc của chúng); `CATALOG.md` / `ORIGIN.md` (skill viết “nếu repo có”);
`knowledge/incoming/` (gitignored, sinh khi dùng); `.git/index.lock` (artifact lúc chạy).

### E — Gate không bao giờ đỏ được

`features/_index.json` chỉ có một entry `example-feature` trỏ vào `features/example-feature.json`
— **file không tồn tại**. `node tooling/check-feature-integrity.mjs` in “(không có gì để báo cáo)”
và exit 0. Trong khi AGENTS.md §Verification (“Default-FAIL… `evidence` bắt buộc”) dựa vào đúng
cơ chế này. Một gate luôn xanh tệ hơn không có gate, theo chuẩn của chính repo.

### F — Câu hỏi về khối lượng, KHÔNG phải lỗi (cần bạn quyết)

Harness cho **nhiều người** đang áp lên project **một người**: `reservations/` (chỉ có README),
`docs/TEAM.md`, `docs/MULTI-PROJECT.md`, `docs/WIP.md`, `docs/BRANCH-PROTECTION.md`,
`docs/CONFLICTS.md`, `.github/CODEOWNERS`, `evals/`, `harness-migrations/` (10 file).
Cộng lại: `tooling/` 8 776 + `.claude/` 3 265 + `docs/` 2 581 ≈ **14.6k dòng harness** cho
≈ 44k dòng app — **một phần tư repo**.

AGENTS.md và `knowledge/README.md` nói harness này **cố ý mang đi được sang project khác**. Nếu
vai trò “repo này cũng là template harness” là thật thì **giữ hết**, và thêm MỘT dòng vào
AGENTS.md nói vậy — vì hiện không có chỗ nào nói, nên mỗi lần rà soát sẽ lại đề nghị cắt.
Nếu vai trò đó không còn thì đây là nhát cắt lớn nhất còn lại trong repo.

---

## Quy trình đề xuất — 6 vòng, mỗi vòng một PR, mỗi vòng có phép kiểm tất định

Thứ tự theo (giá trị × độ chắc) ÷ rủi ro. Không big-bang: một refactor dedupe lớn không
revert được từng phần.

### Vòng 0 — biến ba phép đo thành công cụ trong repo (làm TRƯỚC mọi thứ)
Ba script tôi vừa viết đang nằm ở scratchpad, tức là sẽ mất. Đưa vào `tooling/`:
`dead-exports.mjs` (TS compiler API, đã sửa bẫy Windows dấu `\` vs `/` — không có nó thì
MỌI export trông như chết), `doc-links.mjs` (bỏ `HARNESS-CHANGELOG.md` + `.claude/learnings/**`
khỏi phạm vi), và một wrapper jscpd có **ratchet**.
Ghi baseline: dup 1.02% · 17 clone · 2 file mồ côi · 27+15 đường dẫn chết.
**Kiểm:** ba script chạy được trên cả 3 OS (Node `.mjs`, `path.join`, không bash).
*Không có baseline thì “tiến hay lùi” là chưa đo được, không phải không đổi.*

### Vòng 1 — xoá code chết, rủi ro gần 0
B1 B2 B3 B4 B6. **Kiểm:** `npm run verify` + `node tooling/gates.mjs --stage stop` + `npx playwright test`.

### Vòng 2 — sửa mọi con trỏ hỏng (giá trị/công cao nhất)
D1 D2 D3 D4 D5 D6. Với D1: hoặc **viết lại 5 plan doc** từ chính code đã có, hoặc **xoá 16
comment trỏ vào chúng** — nhưng không để nguyên. Với D3/D4: tạo file, hoặc bỏ khỏi AGENTS.md
(cần `/harness-propose` vì AGENTS.md nằm trong danh sách không sửa).
**Kiểm:** `tooling/doc-links.mjs` xanh, và nó vào stop gate.

### Vòng 3 — dependency
C1 C2 C3. **Kiểm:** `npm run verify` + `docker compose build` + so kích thước image trước/sau.

### Vòng 4 — reuse lớn: hai bảng (A1)
Rủi ro cao nhất trong danh sách, nên đi sau khi đã có lưới. **Trước khi sửa**: hai bảng này
hiện chỉ được e2e chạm qua `/resources?tab=grammar`; cần một spec chạm cả tab vocab (sort,
lọc, chọn dòng, bulk action) — viết test TRƯỚC, refactor SAU.
**Kiểm:** e2e mới xanh cả hai tab + dup giảm (đo lại jscpd) + test xanh. **Cả hai, không một.**

### Vòng 5 — boilerplate nhỏ
A3 (`<SelectFilterRow>`), A4, A5, B7 (bỏ `export` thừa). Mỗi cặp một commit.
**Kiểm:** dup giảm + `dead-exports.mjs` ngắn lại + test xanh.

### Vòng 6 — ba quyết định sản phẩm (không phải việc code)
1. **Calibration shadow (B5)**: mở UI/MCP để duyệt proposal, hay xoá nửa chết? Hiện dữ liệu
   vào mà không ai ra được.
2. **`features/` (E)**: dùng thật (viết feature file cho các tính năng đang có) hay bỏ cơ chế?
   Đang là gate luôn xanh.
3. **Harness team trên project một người (F)**: giữ vì vai trò template, hay cắt?

---

## KHÔNG chạm (đã cân nhắc, có lý do)

- **Re-export của `components/ui/*`** (Radix/shadcn: `DropdownMenuSub*`, `SelectScrollUpButton`, …).
  Đây là bề mặt primitive vendored — thiếu một nửa mới là lỗi. Cùng lý lẽ với “không dedupe
  generated code”.
- **`lib/generated/prisma`** — generator sở hữu nó.
- **Trùng lặp trong test** — thường là *dễ đọc*, không phải nợ.
- **`app/items/page.tsx` + `app/vocab/page.tsx`** — stub `redirect('/resources')` 6 dòng, có
  comment ghi rõ lý do (giữ bookmark cũ khỏi 404). Không phải code chết.
- **Self-clone trong `guide-steps.tsx`** — là bảng DỮ LIỆU (các bước hướng dẫn), gom lại sẽ
  làm nội dung khó đọc hơn.

---

## 2026-08-06 22:45 (session 1, Claude) — VÒNG 0 + VÒNG 1 XONG

- **ĐÃ LÀM — Vòng 0 (biến phép đo thành công cụ)**
  - `tooling/entropy-scan.mjs` §9b **mở rộng, không tạo file mới**: phép kiểm “đường dẫn trỏ vào
    hư không”, quét cả backtick trong .md **và comment trong source** — chỗ duy nhất tìm ra nhóm
    `docs/plans`. §4 cũ chỉ kiểm skill trỏ vào `tooling/*.mjs` nên cả nhóm này lọt lưới.
    Theo đúng bước 0 của `/dedupe-scan`: “Đã có → MỞ RỘNG cái có sẵn, không tạo cái mới song song.”
  - `tooling/dead-exports.mjs` **mới** — TypeScript compiler API, có `--baseline` và `--list`.
  - `tooling/dup-scan.mjs` **mới** — tự chứa, không cần mạng (Parity Contract: một gate chỉ xanh
    khi có wifi thì không phải gate). Đã ghi cả phần đối chiếu với jscpd, gồm chỗ **không** khớp.
  - Đã ghim baseline cho cả hai (`.claude/state/`, gitignored — mốc là chuyện của từng máy,
    cùng quy ước với `harness-size`).
- **ĐÃ LÀM — Vòng 1 (xoá code chết)**
  - Xoá `components/shared/motion-primitives.tsx` (84 dòng) và `components/ui/scroll-area.tsx`.
  - Xoá `skipSentenceAction` khỏi `app/actions.ts` (+ import `skipSentence` theo nó). `skipSentence()`
    trong `lib/practice.ts` **giữ nguyên** — MCP tool `skip_sentence` đang dùng.
  - Xoá `getUserId` khỏi `lib/mcp/tool-kit.ts`.
  - Xoá entry `'components/landing/'` khỏi `DISPLAY_ALLOW` trong `lib/type-scale.test.ts`.
  - Mỗi chỗ xoá để lại một comment nói **cái gì đã thay thế nó** — không xoá im lặng, vì người đọc
    sau sẽ tưởng tính năng đó chưa bao giờ có.
- **BẰNG CHỨNG**
  - `npm run verify` exit 0 — 51 file test, **671 test passed**, build production sạch.
  - `node tooling/gates.mjs --stage stop` — gen-clean OK · typecheck OK · test OK.
  - `npx playwright test` — **22 passed**.
  - `node tooling/dead-exports.mjs`: `so với baseline: orphanFiles -1, looseExports -2` — mốc hoạt
    động, tức là từ giờ “tiến hay lùi” đo được thật.
  - `node tooling/dup-scan.mjs`: 3.09% (851/27 513 dòng có nghĩa, 38 khối). Vòng 1 **không** làm
    giảm trùng lặp, và đúng như vậy: nó xoá code chết, không gom code. Nói ra để con số không bị
    gán cho công không làm.
- **PHÁT HIỆN MỚI trong lúc làm Vòng 0** (đã thêm vào bảng trên)
  - **A6**: `data-table.tsx` tự chứa bản sao của cơ chế `useSessionState`. Công cụ tìm ra, tôi thì
    không — và jscpd ở cấu hình đã dùng cũng bỏ qua. Ban đầu tôi tưởng nó là dương tính giả
    (hai file không liên quan gì nhau) nên đã đi kiểm; hoá ra là thật.
  - **B7 = 137, không phải ~40** như tôi đoán ở bản đầu.
  - Bẫy Windows trong chính công cụ: `path.resolve` trả `\`, TypeScript đánh index bằng `/`, và
    `getSourceFile()` là phép tra map thuần — bản đầu của `dead-exports` báo **cả repo** là code
    chết. Nếu tin con số đó thì đã xoá nửa repo. Đã ghi thành comment trong file để không ai gỡ
    dòng chuẩn hoá đó ra.
  - Cùng lớp lỗi, lần thứ hai trong ngày: `rel()` trong `entropy-scan.mjs` cũng in `\` — đã sửa,
    nên mọi dòng báo cáo của file đó giờ copy-paste được.
- **TIẾP THEO**
  - Vòng 2 (sửa 11 đường dẫn chết) — `node tooling/entropy-scan.mjs` hiện **exit 1** vì đúng nhóm
    này. Đó là chủ ý: nó chưa từng đỏ nên chưa ai thấy.
  - Vòng 3 (deps), Vòng 4 (hai bảng — viết e2e tab vocab TRƯỚC), Vòng 5 (boilerplate nhỏ + A6).
  - Ba câu ở Vòng 6 vẫn chờ người trả lời.
- **ĐANG VƯỚNG**
  - `tooling/**` không nằm trong phạm vi eslint (config bỏ qua), nên hai script mới **không được
    lint**. Đã `node --check` cả ba. Đây là quyết định cũ của repo, không phải thứ tôi đổi ở đây —
    nhưng nó có nghĩa là 8 776 dòng `tooling/` đang không có lint. Ứng viên cho một vòng sau.

---

## 2026-08-06 23:35 (session 1, Claude) — VÒNG 2 XONG

- **QUYẾT ĐỊNH mở đầu vòng**: **không** tái tạo năm plan doc. Chúng chưa bao giờ ở trong repo này, nên
  “viết lại” chỉ có thể là suy diễn từ code — và một tài liệu bịa ra tệ hơn không có tài liệu, vì nó
  trông như bằng chứng. Ghi thành `docs/adr/0002-ho-so-thiet-ke-nam-ngoai-repo.md`: **comment trong
  code là thẩm quyền thiết kế của app này**, comment phải tự đứng được, và không viện dẫn tài liệu
  không tồn tại.
  Tôi đã **vi phạm chính quyết định đó trong 5 phút đầu**: sửa `lib/calibration.ts` bằng cách viết ra
  hai phương án “đã bị loại” (IRT, rule table) mà tôi không có bằng chứng nào. Đã hoàn lại ngay. Đó
  đúng là hành vi mà con trỏ chết khuyến khích, và nó là lý do ADR 0002 tồn tại.
- **ĐÃ LÀM** — 17 chỗ, giữ nội dung, bỏ con trỏ:
  - 14 file source + `lib/spoken-line.test.ts` + `lib/select.ts` (2 chỗ) — bỏ mọi viện dẫn tới plan
    doc / decisions / 00-map. Chỗ nào con trỏ mang lý lẽ thì chuyển lý lẽ thành prose tại chỗ
    (`lib/scaffolding.ts`: nêu thẳng “inverted trust model” là gì; `lib/enrichment-merge.ts`: nói rõ
    nó là hard dependency chứ không phải nicety).
  - `prisma/schema.prisma` (2 chỗ) — sửa ở NGUỒN rồi `npm run gen`, vì generated client chép lại
    comment schema vào 4 file. `lib/generated/` gitignored nên không có gì phải commit.
  - `docs/progress/_TEAM.md` — đường dẫn ADR sai (`docs/adr/` → `docs/adr/harness/`).
  - `tooling/entropy-scan.mjs` — thêm `.claude/whats-new.md` và fixture của test vào nhóm loại trừ.
- **KHÔNG sửa, vì chúng ĐÚNG**: `.claude/whats-new.md` nhắc `stop-gate.mjs` **để nói rằng hook đó đã
  bị bỏ**; `docs/CONFLICTS.md` + ADR harness nhắc `feature_list.json` như **cột “trước”** trong bảng
  so sánh thiết kế. Hai cái này là lịch sử đang làm đúng việc của nó, không phải link mục.
- **BẰNG CHỨNG**
  - `node tooling/entropy-scan.mjs` **exit 0** — không còn FAIL. Từ 11 → 0. (Dọc đường phát hiện thêm
    6 chỗ mà bản đo đầu bỏ sót vì tôi `head -25` cái grep.)
  - `npm run verify` exit 0 — 671 test passed, build sạch. Stop gate xanh. `npx playwright test` 22 passed.
- **BÀI HỌC đã ghi** → `.claude/learnings/2026-W32-claude.md`: **ba lần trong một session**, một tài
  liệu BÁO CÁO về đường dẫn hỏng lại bị chính phép kiểm tố giác — nhật ký rà soát, ADR, rồi comment
  trong chính scanner. Không phải cẩu thả ba lần: văn bản *nói về* một đường dẫn không phân biệt được
  với văn bản *trỏ tới* nó nếu chỉ nhìn hình dạng chuỗi. Luật đã cưỡng chế bằng máy (4 nhóm nguồn
  lịch sử + fixture được loại trừ), và quy tắc viết: gọi tên một đường dẫn đã mất thì viết văn xuôi,
  đừng bọc backtick.
- **CẦN NGƯỜI GÕ** (agent bị hook chặn, đúng thiết kế) — 2 dòng trong `AGENTS.md`, chi tiết trong file
  learnings ở trên: bảng “Đọc thêm” trỏ tới `README.md` không tồn tại (đổi sang `knowledge/README.md`,
  file này có thật), và danh sách KHÔNG SỬA liệt `.mcp.json` cũng không tồn tại. Bỏ hai dòng đưa
  AGENTS.md từ 154 về 152 dòng (ngưỡng 150).
- **TIẾP THEO**: Vòng 3 (3 dependency), Vòng 4 (hai bảng — e2e tab vocab TRƯỚC), Vòng 5 (boilerplate
  nhỏ + A6). Ba câu Vòng 6 vẫn chờ người.

## Cảnh báo tự đặt cho các vòng sau

Đừng “dedupe theo điểm số”. Mỗi clone bị bỏ qua có chủ ý phải ghi **lý do vào file**, và số
clone `wontfix` phải báo **riêng**, không được trộn vào “đã giảm duplication”. Một báo cáo nói
“1.02% → 0.4%” mà nửa phần giảm là wontfix bị giấu thì tệ hơn không báo cáo.
