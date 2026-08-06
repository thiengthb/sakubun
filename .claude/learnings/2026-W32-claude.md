# Learnings — tuần W32, claude (agent)

<!-- ĐỀ XUẤT, chưa phải harness. DRI quyết định promote → /knowledge-promote. -->

## Một phép kiểm "đường dẫn có tồn tại không?" sẽ tố giác chính tài liệu báo cáo về nó

**Lần xuất hiện** (ba lần, cùng một session — commit `6d0ed17` và commit tiếp theo sau nó):

- **Lần 1** — `docs/progress/optimize-sweep.md` liệt kê các đường dẫn chết tìm được. Lần chạy đầu của
  phép kiểm mới, chính nhật ký đó là nguồn bị tố giác nhiều nhất, vì nó **trích dẫn** đúng những đường
  dẫn nó vừa phát hiện.
- **Lần 2** — `docs/adr/0002-ho-so-thiet-ke-nam-ngoai-repo.md`, ADR ghi lại quyết định "không viện dẫn
  tài liệu không tồn tại", bị bắt vì nó viết tên ba tài liệu không tồn tại trong backtick.
- **Lần 3** — comment trong `tooling/entropy-scan.mjs`, chính file chứa phép kiểm, khi tôi ghi ra hai
  đường dẫn fixture làm ví dụ. Phép kiểm quét cả file của chính nó.

**Lớp lỗi:** verification

Đây không phải lỗi cẩu thả ba lần. Nó là một tính chất: **văn bản NÓI VỀ một đường dẫn hỏng không phân
biệt được với văn bản TRỎ TỚI nó**, nếu phép kiểm chỉ nhìn hình dạng chuỗi. Và mọi phép kiểm dạng
"X phải tồn tại" đều có phiên bản của vấn đề này — changelog, ADR, nhật ký rà soát, fixture của test và
tài liệu về chính phép kiểm đều là những nơi HỢP LỆ để nhắc một cái tên đã chết.

**Dạng biểu diễn đề xuất:** `3 computational-control` — và **đã implement** trong cùng commit.

Vì sao không dùng được dạng rẻ hơn: (1) test/contract không áp được vì đối tượng là văn bản tự do trong
mọi file .md và mọi comment, không phải một API; (2) generator không áp được vì không có gì được sinh ra.
Dạng 3 là cái cao nhất khả thi, và nó đã ở đúng chỗ: `tooling/entropy-scan.mjs` §9b.

**Nội dung luật đã cưỡng chế:** phép kiểm loại trừ bốn nhóm nguồn LỊCH SỬ —
`HARNESS-CHANGELOG.md`, `.claude/learnings/**`, `docs/progress/**`, `.claude/whats-new.md` — cộng
fixture của test (`tooling/test-*`, `**/fixtures/**`). Và một quy tắc viết: khi cần **gọi tên** một
đường dẫn không tồn tại, viết dưới dạng văn xuôi, đừng bọc backtick.

**Tầng:** project (nhưng nội dung mang đi được — xem Scope)

**Scope:** `universal`

Test *"nếu tôi xoá repo này, mục này còn giá trị không?"* → **Còn.** Bất cứ ai viết một linter cho
đường dẫn/link trong tài liệu sẽ gặp đúng ba lần này. Nó không phụ thuộc stack, không phụ thuộc ngôn
ngữ, và nó là lý do các link-checker thương mại đều có khái niệm ignore-list — nhưng gần như không tài
liệu nào giải thích rằng nhóm cần ignore là **nhóm nói về lịch sử**, chứ không phải nhóm "gây ồn".

**Đặt ở tầng nào của thang độ trễ:** chạy tay + qua `harness-doctor`, **không** ở stop gate. Vì sao
không đặt nhanh hơn: nó quét toàn bộ .md + toàn bộ comment source (62 file .md, ~360 file source), và
nhóm lỗi nó bắt không làm hỏng build — để nó ở stop gate là trả thuế độ trễ mỗi lần dừng cho một tín
hiệu không cấp bách.

**Chi phí bảo trì dự kiến:** thấp. Danh sách loại trừ tăng khi repo thêm một loại tài liệu-lịch sử mới,
tức là hiếm. Rủi ro thật là ngược lại: có người nới danh sách loại trừ để làm cho phép kiểm im lặng —
nên mỗi lần thêm một nhóm loại trừ phải kèm lý do **vì sao nhóm đó là lịch sử**, không phải "vì nó ồn".

**Điều kiện thoát:** nếu repo bắt đầu có hồ sơ thiết kế thật trong `docs/adr/` + `docs/specs/` và không
còn comment nào cần gọi tên tài liệu đã mất, phần "viết văn xuôi thay vì backtick" hết tác dụng — lúc
đó chỉ cần giữ danh sách loại trừ.

---

## Hai con trỏ chết trong AGENTS.md — cần NGƯỜI sửa, agent bị hook chặn

**Triệu chứng:** `AGENTS.md` nhắc hai file **không tồn tại**:

1. Bảng “Đọc thêm” gửi người đọc tới `README.md` cho việc “Áp harness lên project mới” — file đó không
   có trong repo (`ls README.md` → không tìm thấy).
2. Danh sách **KHÔNG SỬA** liệt `.mcp.json` — file đó cũng không có. `node tooling/harness-size.mjs`
   báo `mcp servers: 0`, khớp: project này không có MCP server nào khai ở tầng repo.

**Lớp lỗi:** context

Một dòng “KHÔNG SỬA `.mcp.json`” vô hại về mặt an toàn, nhưng nó dạy người đọc rằng danh sách đó không
được kiểm — và một danh sách cấm mà có mục không thật thì các mục còn lại cũng mất trọng lượng.
Còn `README.md` thì tệ hơn: nó là mục **duy nhất** trong bảng “Đọc thêm” cho tình huống “áp harness lên
project mới”, nên người đọc theo chỉ dẫn đó sẽ đi vào chỗ trống.

**Đề xuất (2 dòng, DRI gõ — hook chặn agent, đúng như thiết kế):**

- Hoặc bỏ `README.md` khỏi bảng “Đọc thêm” (và trỏ sang `knowledge/README.md`, file NÀY thì có thật),
  hoặc tạo `README.md`.
- Bỏ `.mcp.json` khỏi danh sách KHÔNG SỬA cho tới khi project thực sự có file đó. Bốn mục còn lại
  (`settings.json`, `hooks/**`, `rules/**`, `harness.config.json`) đều tồn tại và đều đang được hook
  bảo vệ thật.

Nhân đây: `AGENTS.md` đang **154 dòng** so với ngưỡng 150 mà chính nó tự đặt (`harness-size` WARN).
Bỏ hai dòng trên đưa nó về 152 — vẫn quá, nhưng đi đúng hướng.
