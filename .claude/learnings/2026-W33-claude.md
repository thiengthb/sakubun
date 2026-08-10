# Learnings — tuần W33, claude

<!-- ĐỀ XUẤT, chưa phải harness. DRI quyết định promote → /knowledge-promote. -->

## Gate nào in ra hơn 1 MiB thì bị BÁO ĐỎ dù nó pass — `runConfigured` không đặt `maxBuffer`

**Lần xuất hiện** (cần ≥2):

- PR #2 (run 31371... job 93399544797) — `FAIL e2e: FAIL → /tmp/harness-e2e-2930.log` trên một
  nhánh mà diff **chỉ là 15 dòng comment** trong `docker-compose.yml`. Không có gì để làm đỏ e2e.
- PR #3 (run 31371318515) — cùng `FAIL e2e` trên một nhánh chỉ đổi comment trong `ci.yml`.
  Nhưng report Playwright của đúng run đó, lấy được sau khi thêm bước upload artifact, cho
  **28/28 test PASS**. Gate nói đỏ trong khi Playwright nói xanh.
- Đối chứng cùng base (`bfb19dd`): PR #1 → `OK e2e (358256ms)`; main 2026-08-07 (run
  31145407602) → `OK e2e (345392ms)`; PR #3 lần chạy sau → `OK e2e (314849ms)`.
  **Bốn lần OK, hai lần FAIL, không diff nào giải thích được** — dấu hiệu của ngưỡng, không
  phải của lỗi test.

**Nguyên nhân, đã tái hiện cô lập** (không phải suy đoán):

`tooling/lib/harness.mjs → runConfigured` gọi `spawnSync(cmd, { shell, encoding:'utf8',
stdio:'pipe' })` và **không truyền `maxBuffer`**, nên mặc định 1 MiB của Node có hiệu lực.
Vượt ngưỡng thì Node **giết tiến trình con**. Chạy lại đúng bộ option đó:

| stdout của lệnh | `status` | `signal` | `error` | `status ?? 1` |
|---|---|---|---|---|
| 100 KB | `0` | – | – | 0 → PASS |
| 2 MB | `null` | `SIGTERM` | `ENOBUFS` | **1 → FAIL** |
| 2 MB + `maxBuffer: 64MB` | `0` | – | – | 0 → PASS |

Hai lỗi chồng nhau, và lỗi thứ hai mới là lỗi đắt:

1. `maxBuffer` chưa khai. Gate `e2e` pipe cả log `[WebServer]` của `next dev` (better-auth
   warning, nội dung email, mỗi lời gọi MCP…) nên tổng output dao động quanh 1 MiB — chính
   xác là điều kiện sinh ra một gate lúc xanh lúc đỏ trên cùng một commit.
2. `return { status: r.status ?? 1 }` **ném đi** `r.error` và `r.signal`. Một sự cố của
   harness (ENOBUFS/SIGTERM) được báo cáo y như một test đỏ. Người đọc CI đi tìm bug trong
   test của mình — chỗ không có gì sai. Cùng lớp lỗi với thông điệp P2025 ở
   `lib/mcp/tool-kit.ts` mà PR #1 vừa sửa: **một chẩn đoán sai đắt hơn không chẩn đoán.**

**Lớp lỗi:** verification (gate không đáng tin) + recovery (thông điệp dẫn đi sai hướng)

**Dạng biểu diễn đề xuất:** `1 test/contract` — kèm sửa cơ chế.

- Sửa: truyền `maxBuffer` đủ lớn (64 MiB) trong `runConfigured`, và khi `r.status == null`
  thì báo cáo **đúng cái đã xảy ra** (`signal`/`error.code`), đừng gộp vào `1`.
- Test hoá: một test cho `runConfigured` với lệnh in 2 MB → phải PASS; và một test chốt rằng
  lệnh bị signal-kill được báo là lỗi hạ tầng, không phải "gate đỏ".

Vì sao không dùng dạng rẻ hơn: đây là bug trong chính runner của mọi gate, không phải một
thói quen của agent. Không có rule/gotcha nào sửa được nó, và một dòng "nhớ đặt maxBuffer"
trong tài liệu thì không ai đọc lúc gate đỏ lúc 2 giờ sáng.

**Tầng:** org (file thuộc MECHANISM_PATHS, `upgrade.mjs` sẽ ghi đè bản sửa cục bộ)

**Scope:** `universal` — mọi project dùng harness này đều có, và nó cắn đúng vào gate ồn ào
nhất (e2e). Xoá repo này thì mục vẫn còn giá trị nguyên vẹn.

**Tầng độ trễ:** nằm ở chính `runConfigured`, tức tầng thấp nhất — không đặt được nhanh hơn.

**Chi phí bảo trì:** ~0. Một tham số và một nhánh `if`.

**ĐIỀU KIỆN THOÁT:** hết cần khi `runConfigured` không còn dùng `stdio:'pipe'` (ví dụ đổi sang
stream ra file), hoặc khi Node bỏ giới hạn `maxBuffer`. Kiểm bằng cách grep `spawnSync` trong
`tooling/lib/harness.mjs`.

---

## `gates.preMerge` hứa 3 gate không tồn tại, nên CI của project đích KHÔNG BAO GIỜ xanh được

**Lần xuất hiện:**

- main, run 31145407602 (2026-08-07) — **mọi gate OK, kể cả e2e**, job vẫn `failure`:
  `⛔ Phiên KHÔNG có người ngồi xem và 3 gate bị BỎ QUA` → exit 2.
- PR #1, job 93398092838 — `OK e2e (358256ms)`, mọi gate xanh, vẫn đỏ vì đúng dòng đó.
- PR #3, job 93413027052 — lần thứ ba, 6/6 gate OK, vẫn đỏ.
  Trong khi `--list` nói thẳng: `depcruise`, `a11y`, `perf` **KHÔNG có lệnh → gate này không
  tồn tại, dù nó nằm trong config**.

**Vấn đề thứ hai, và nó là bẫy:** thông điệp của chính gate khuyên
`đặt HARNESS_ALLOW_SKIPPED_GATES=1 nếu đây là chủ ý`. Nhưng `tooling/lib/harness.mjs` (chỗ
định nghĩa `CI_ESCAPE_HATCH`) ghi rõ cửa thoát đó **"đúng ở REPO TEMPLATE, SAI ở mọi project
đích (gate bị bỏ qua vẫn cho tick XANH)"**, và `apply-to` xoá nó khi copy, migration `004`
xoá nó ở project đã áp, `harness-doctor` **báo CHẶN nếu nó còn**. Repo này là
`repoRole: consumer` (đo bằng `repoRole()`). Nên ai làm theo lời khuyên của gate sẽ tự tạo
một dòng CHẶN của doctor — công cụ khuyên một việc mà công cụ khác cùng bộ sẽ phạt.

**Lớp lỗi:** verification (gate fail-đóng vì thứ không tồn tại) + context (lời khuyên đúng
cho template, sai cho consumer, mà không nói rõ điều kiện)

**Dạng biểu diễn đề xuất:** `3 computational-control`

- `gates.preMerge` chỉ nên liệt kê gate CÓ lệnh. Ba cái kia: hoặc khai lệnh thật, hoặc gỡ
  khỏi config — không để config hứa thứ không có.
- Và thông điệp fail-đóng phải **nói rõ điều kiện**: ở `repoRole: consumer` thì lối ra là
  khai lệnh hoặc gỡ gate, KHÔNG phải cửa thoát. `repoRole()` đã có sẵn, đọc được ngay tại
  chỗ in thông điệp.

Vì sao không dùng dạng rẻ hơn: một test không sửa được việc config hứa sai; và đây đúng là
tầng `computational-control` — chỗ danh sách gate được thi hành.

**Tầng:** org (`harness.config.json` thuộc `paths.harness`; thông điệp nằm trong
`tooling/gates.mjs`, cũng là MECHANISM)

**Scope:** `universal`

**Tầng độ trễ:** CI. Không đặt nhanh hơn được — nó là về nội dung config, không về tốc độ.

**Chi phí bảo trì:** thấp. Nhưng để nguyên thì chi phí cao và âm ỉ: CI đỏ vĩnh viễn dạy cả
đội bỏ qua CI đỏ, và lúc đó gate không còn bảo vệ gì nữa.

**ĐIỀU KIỆN THOÁT:** hết cần khi `gates.*` chỉ còn tên có `commands` tương ứng — kiểm bằng
`node tooling/gates.mjs --list`, không còn dòng `n/a`.

---

## Đề xuất CẮT BỎ

- [x] **`e2e/mcp.spec.ts` trước 2026-08-10 chốt `ping` mà không chốt việc gì hữu ích.**
      Không cắt hẳn (ping vẫn là phép thử giao thức rẻ), nhưng nó từng là **toàn bộ** lưới
      e2e của tầng MCP, và một lưới chỉ chứng minh "giao thức còn sống" đã để lọt một buổi
      mà `submit_review` không chấm nổi lượt nào. PR #1 thêm lượt luyện thật. Bài học đáng
      cắt là *niềm tin* rằng có test e2e cho một bề mặt nghĩa là bề mặt đó được gác.
- [ ] `docs/onboarding.md` và `docs/ROADMAP-30D.md` nhắc `/login`, `/whats-new`,
      `/resources`, `/history` — cả bốn **không có SKILL.md** (harness-doctor liệt kê là
      tham chiếu chết). Hoặc sửa chỗ nhắc, hoặc dựng lại. Chưa xử trong tuần này.
