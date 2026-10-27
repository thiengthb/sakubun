# Kế hoạch phase 8: Kaiwa canvas và kho chung

- Ngày: 2026-10-27. Duyệt: chờ thien.
- Yêu cầu của thien (2026-10-27): làm **Kaiwa canvas** và **kho chung** trước 7.4 và các lỗi nhỏ; muốn Kaiwa có mặt
  sớm. Có bản Kaiwa sơ bộ thì sửa UI (7.4) và lỗi cùng lúc với các trang mới. Làm kĩ cơ chế, vì hiện tính năng
  "chưa kiểm soát kĩ, còn vài chỗ hơi off".
- Gốc: kế hoạch hợp nhất `nuc-infra/docs/research/2026-10-10-app-merge-plan.md` (giai đoạn 4, Kaiwa) và phần chia
  sẻ của bản sakubun nhiều người dùng cũ (`thiengthb/sakubun-multiuser-archive`, `lib/library.ts`,
  `docs/plans/2026-07-21-multi-user-deploy-sharing.md`).

Hai mảng độc lập, chung một chỗ gặp: kịch bản Kaiwa là **một loại tài nguyên** có thể đưa lên kho chung khi người
viết muốn; không đưa thì chỉ người viết thấy.

## Thứ tự

1. **Kaiwa sơ bộ** (K1–K3): soạn, xem, nghe, furigana tự động. thien muốn có sớm.
2. **Kho chung** (L1–L6), **Ôn nhanh** (phần C) và **7.4 sửa UI + lỗi trong STATUS** làm xen nhau: trang mới (Kho
   chung, Hội thoại) và Ôn nhanh làm thẳng theo UI mới.
3. Phần Kaiwa còn lại (K4–K8) xen vào theo thứ tự thien chọn. K6 (đưa kịch bản lên kho chung) cần L1 xong trước.

## Phần A. Kho chung

### Ý của thien (2026-10-27)

Kho chung là kho ngữ pháp và từ vựng chung của cả hệ thống, như chợ tài liệu của Quizlet: một cộng đồng chia sẻ.

- Khởi đầu bằng OpenJLPT (518 mẫu ngữ pháp, 7.811 từ).
- Tài khoản mới **bắt đầu trống**: tự lấy về từ kho chung, hoặc tự thêm qua đề xuất cùng AI của chính họ, để tự khám
  phá.
- Người học tự tạo được mẫu kết hợp dài hơn hay từ mà kho chưa có; giữ riêng, hoặc công khai lên kho chung cho
  người khác **mang về**, và người mang về có thể **sửa thành bản mới** rồi chia sẻ lại.
- Hai cách lấy (thien, 2026-10-27): lấy **từng mục** riêng lẻ (mẫu hay từ không cần liên quan nhau), hoặc lấy cả
  một **nhóm** (tính năng Nhóm đang có) mà người khác đã gom các mục liên quan rồi công khai, chép về học luôn,
  không cần qua bộ lọc.

### Bản cũ đã làm thế nào, và đổi gì

Bản nhiều người dùng cũ để `visibility` (`private`/`public`) và `forkedFromId` ngay trên `Item`, thư viện đọc chéo
kho của mọi người bằng SQL tay (chỉ cột nội dung), "lấy về" chép nội dung thành `Item` mới với lịch FSRS mới, có
`ItemLike`, chỉ mục tự viết (không phải bản lấy về) mới được công khai.

Đề xuất giữ cách **chép khi lấy** (lịch FSRS là của từng người, không dùng chung một dòng), nhưng đổi chỗ chứa:

| | Bản cũ | Đề xuất |
| --- | --- | --- |
| Bản công khai ở đâu | Chính dòng `Item` của người viết | Bảng riêng `LibraryEntry`, là **bản chụp** lúc công khai |
| Sửa mục của mình sau khi công khai | Người khác thấy ngay bản đang sửa dở | Không ai thấy tới khi bấm "Cập nhật bản chia sẻ" |
| Đọc thư viện | SQL tay đọc chéo bảng học của mọi người | Đọc `LibraryEntry`, không đụng bảng học của ai; luật `userDb` giữ nguyên |
| OpenJLPT | Chép vào kho từng người | Là các mục của kho chung, tác giả "OpenJLPT", không thuộc người nào |
| Bản lấy về rồi sửa | Không công khai lại được | Công khai được thành mục mới, ghi "dựa trên" mục gốc |

### Dữ liệu (một migration cộng thêm, K1 và L1 tách nhau)

- `LibraryEntry`: `id`, `type` (`GRAMMAR`, `VOCAB`, `GROUP`, sau này `SCRIPT`), nội dung (`expression`, `reading`,
  `hanviet`, `meaningVi`, `level`, `notes`, `enrichment` cho ngữ pháp; `body` cho kịch bản), `authorId` (null =
  OpenJLPT), `basedOnId` (mục gốc nếu là bản sửa lại), `sourceItemId` (mục trong kho người viết), `status`
  (`public`, `hidden` khi tác giả gỡ hoặc quản trị ẩn), `takeCount`, `createdAt`, `updatedAt`.
  Nhóm dùng `name` và `notes`.
- `LibraryGroupMember` (groupEntryId, itemEntryId, thứ tự): nhóm công khai gồm những mục kho chung nào.
- `LibraryLike` (entryId, userId) duy nhất theo cặp.
- `Group.libraryEntryId` (null được): nhóm này chép từ nhóm kho chung nào.
- `Item.libraryEntryId` (null được): mục này lấy từ mục kho chung nào. Dùng để biết "đã có", hiện nguồn, và sau này
  báo "bản gốc vừa cập nhật".
- Bảng `LibraryEntry` không phải bảng học, nên đọc bằng client chung; tạo, sửa, gỡ đi qua một module
  `lib/library/` duy nhất, kiểm tác giả trong code.

### Cơ chế (luật server ép, có test)

1. **Lấy về** = chép nội dung vào `Item` của người lấy, lịch FSRS mới (vào hàng "mẫu mới", theo hạn mức mỗi ngày như
   mọi mục mới), `libraryEntryId` trỏ về mục gốc, `takeCount` tăng một. Không chép sao, tạm dừng, ghi chú riêng, lịch
   sử ôn của ai.
2. **Đã có**: kho mỗi người đã duy nhất theo (loại, biểu thức). Lấy một mục trùng thì không tạo thêm, báo "đã có
   trong kho". Lấy một nhóm thì bỏ qua mục đã có (vẫn thêm vào nhóm) và báo số đã thêm.
3. **Tạo mới** (kể cả mẫu kết hợp dài): như thêm mục hôm nay, mặc định riêng tư. Thêm kiểm độ dài từng trường.
4. **Công khai** chỉ từ web, người học bấm. AI qua MCP **không** công khai được (tool không có lối đó). Mỗi mục kho
   riêng có nhiều nhất một bản công khai đang mở.
5. **Mục lấy về rồi sửa**: công khai được nếu nội dung khác bản gốc; mục mới ghi "dựa trên" bản gốc và tác giả gốc.
   Không sửa thì không công khai lại (tránh nhân bản).
6. **Gỡ**: tác giả gỡ thì mục ẩn khỏi kho chung; người đã lấy vẫn giữ bản của họ, chỉ mất liên kết cập nhật.
7. **Cùng một biểu thức nhiều bản**: được phép, như Quizlet. Kết quả gộp theo biểu thức, bản OpenJLPT đứng đầu
   nhãn "gốc", rồi xếp theo lượt lấy và lượt thích.
8. **Nhóm**: công khai một nhóm thì mỗi mục trong nhóm cũng có bản trên kho chung. Mục tự viết thành bản mới; mục
   đã lấy về mà không sửa thì trỏ tới bản đang có, không nhân bản; mục lấy về đã sửa thành bản "dựa trên". Lấy một
   nhóm về = tạo nhóm mới trong kho mình cùng tên và ghi chú, lấy về các mục chưa có, mục đã có thì chỉ thêm vào
   nhóm. Cập nhật và gỡ nhóm theo luật 4 và 6. Mục riêng tư không bao giờ lọt ra ngoài qua nhóm: chỉ mục trong nhóm
   được công khai, và người học thấy danh sách trước khi bấm.
9. **Quản trị**: ẩn hoặc hiện lại một mục, xem mục của một tài khoản trong `/admin/[id]`. Tài khoản bị chặn thì mục
   của họ ẩn theo. **Xoá tài khoản** (thien 2026-10-27, theo đề xuất): mục và nhóm họ công khai ẩn khỏi kho chung,
   tên tác giả bỏ; người đã lấy giữ bản của họ. Mục đó nằm trong nhóm công khai của người khác thì vẫn hiện trong nhóm
   ấy, tác giả ghi "người dùng đã xoá", vì người gom nhóm đã chọn nó.
10. **Tài khoản mới bắt đầu trống**: bỏ việc chép OpenJLPT lúc đăng ký (7.2b). OpenJLPT lên kho chung thành các nhóm
   có sẵn theo cấp và loại ("N5 ngữ pháp", "N5 từ vựng"…). Trang Phân tích của người trống chỉ tới Kho chung và
   Hướng dẫn. Kho của tài khoản đang có giữ nguyên, không đụng.
11. **AI cùng khám phá**: MCP thêm `library_search` (tìm trong kho chung) và `library_take` (lấy về khi người học
    đồng ý), `lookup` báo khi kho riêng không có nhưng kho chung có. `add_items` vẫn là lối tạo mục riêng. Giữ trong
    ngân sách token của `token-budget.test.ts`.

### Các PR

| PR | Nội dung | Rủi ro |
| --- | --- | --- |
| L1 | Bảng `LibraryEntry`, `LibraryGroupMember`, `LibraryLike`, cột `libraryEntryId` trên `Item` và `Group` (migration cộng thêm), nạp OpenJLPT vào kho chung thành mục và nhóm, module `lib/library/` (tìm, lấy mục, lấy nhóm, đã có) + test | high (schema) |
| L2 | Trang **Kho chung** `/library`: danh sách nhóm, mở nhóm xem mục, lấy cả nhóm; tìm từng mục, lấy một mục. e2e + ảnh | high |
| L3 | Công khai mục và nhóm, cập nhật bản chia sẻ, gỡ, bản sửa lại "dựa trên", thích | high |
| L4 | Tài khoản mới bắt đầu trống, trang Phân tích và Hướng dẫn trỏ tới Kho chung; ghi `docs/decisions/0008-shared-library.md` | high (đổi quyết định 7.2) |
| L5 | MCP `library_search`, `library_take`, `lookup` chỉ sang kho chung | high |
| L6 | Quản trị ẩn/hiện mục, mục ẩn theo tài khoản bị chặn | high |

## Phần B. Kaiwa canvas

### Bản cũ có gì (đọc mã trên laptop, 2026-10-27)

Mã nằm ở OneDrive laptop (`Tài liệu/ChatGPT/japanese-script-canvas`), **không có commit, không có remote**, khoảng
85 KB mã nguồn, không có test. Vite + React 19, server Express 5.

| Phần | Bản cũ làm thế nào | Trong sakubun |
| --- | --- | --- |
| Định dạng kịch bản | Mỗi dòng `A: 日本語 \| tiếng Việt`; nhãn người nói 1–2 chữ Latin; dòng không nhãn là độc thoại; furigana tay `料理[りょうり]`; còn đọc được kiểu markdown cũ `**C:** …` + `**Tiếng Việt:** …` | Giữ nguyên định dạng, chép parser thành hàm thuần có test. Furigana tay trùng đúng cú pháp `parseFurigana` sakubun đang có |
| Soạn | CodeMirror 6, hai khung (bản thảo / xem), nút "Prompt cho AI" chép lời nhờ AI viết kịch bản | Bản sơ bộ dùng ô soạn thường (chữ đơn cách); CodeMirror để tới đợt sửa UI. Giữ nút "Prompt cho AI" |
| Furigana tự động | Server dùng kuroshiro + kuromoji, mỗi dòng gọi một lần lúc xem | Tính một lần **lúc lưu**, lưu kèm kịch bản; dòng đã có `[..]` thì giữ của người soạn |
| Rê chuột tra nghĩa | kuromoji tách từ; nghĩa từ JMdict tiếng Anh + Google Translate (endpoint không chính thức) | Tách từ lúc lưu. Nghĩa **tiếng Việt**: mục của người học trước, rồi kho chung (OpenJLPT có sẵn nghĩa Việt). Không gọi Google. Nút "Thêm vào kho" lấy mục kho chung về, hoặc tạo mục riêng |
| Nghe | `/api/tts` VOICEVOX, 22 giọng, client nhớ 24 đoạn, tải trước 8 dòng, dự phòng giọng trình duyệt | Dùng `/api/tts` sakubun đang có. Thêm **cache file âm thanh trên server**, chọn giọng theo từng người nói |
| Karaoke | Chữ và furigana sáng dần theo tiến độ âm thanh; nghe cả bài | Giữ |
| Từng dòng | Ẩn/hiện, chép, phát; nghĩa Việt hiện khi rê/chạm; phím mũi tên, Enter để phát | Giữ |
| Thư viện kịch bản | Tạo, đổi tên, công khai/riêng, xoá; chủ = email | Bảng `Script` theo từng người học (như 7.1). Công khai = đưa lên kho chung (K6) |
| Đồng biên tập realtime (Yjs), ai đang xem, đăng nhập Google riêng | Có | **Bỏ**, như kế hoạch hợp nhất đã chốt |
| Lưu trữ | `scripts.json` + LevelDB của Yjs | SQLite của sakubun. 5 kịch bản cũ trong bản lưu NUC nhập một lần (K8) |

### Các PR

| PR | Nội dung | Rủi ro |
| --- | --- | --- |
| K1 | Bảng `Script` (migration cộng thêm, `userId` bắt buộc, qua `userDb`), parser thuần chép từ bản cũ + test | high (schema) |
| K2 | Trang **Hội thoại** `/kaiwa` (thanh bên): danh sách kịch bản, tạo/đổi tên/xoá; `/kaiwa/[id]` hai khung soạn và xem, thẻ từng dòng với furigana tay, nghĩa Việt của dòng, ẩn/hiện, phát qua `/api/tts`, nút "Prompt cho AI". e2e + ảnh | high |
| K3 | Furigana và tách từ tự động lúc lưu (kuromoji + kuroshiro trên server; ảnh Docker kèm từ điển kuromoji) | medium |
| K4 | Rê chuột tra nghĩa theo từ: kho riêng rồi kho chung; "Thêm vào kho" | high |
| K5 | Karaoke, nghe cả bài, giọng theo người nói, cache file âm thanh trên server | medium |
| K6 | Đưa kịch bản lên kho chung (loại `SCRIPT`), lấy kịch bản về để sửa | high |
| K7 | MCP: một tool liệt kê, đọc, lưu kịch bản và nhập vai theo kịch bản | high |
| K8 | Nhập 5 kịch bản cũ từ bản lưu NUC trên laptop vào kho của thien | high (dữ liệu) |

## Phần C. Ôn nhanh cần cải thiện sâu

thien (2026-10-27): đáp án chưa có phần dịch; thẻ ngữ pháp nên là câu ví dụ để người học thấy dùng trong trường hợp
nào. Đọc mã hôm nay (`lib/app/quick-review.ts`):

- Câu ví dụ lấy từ thẻ giải thích (do AI viết, có tiếng Việt) hoặc câu OpenJLPT trong ghi chú. Câu OpenJLPT chỉ có
  tiếng Anh, và ôn nhanh bỏ cả tiếng Anh, nên phần lớn thẻ **không có dịch**: chỉ mục đã có thẻ giải thích mới có.
- Mỗi mục OpenJLPT chỉ có **một** câu ví dụ, nên thẻ điền chỗ trống lặp đúng một câu mỗi lần.
- Mục mới là thẻ lật; mục ngữ pháp không có câu khớp thì mặt trước chỉ còn mẫu `〜は`, không có ngữ cảnh.

Hướng đề xuất (kế hoạch chi tiết riêng `docs/plans/…-quick-review.md`, kèm ảnh trước và sau, thien duyệt trước khi
code, vì đổi hành vi học):

1. Thêm **dịch tiếng Việt** cho câu ví dụ OpenJLPT thành dữ liệu tĩnh trong repo (như `vi.json` hôm nay), soạn một
   lần, có người xem lại. Web vẫn không tự sinh câu.
2. Thẻ ngữ pháp **luôn bắt đầu bằng câu ví dụ** (gạch chân mẫu, hoặc điền chỗ trống khi đã gặp), đáp án hiện nghĩa,
   cấu trúc, câu dịch và furigana.
3. Nhiều câu ví dụ mỗi mục, xoay vòng theo ngày: lấy từ thẻ giải thích, và cho AI của người học thêm câu qua MCP khi
   người học muốn (bộ tool MCP hôm nay chưa có lối ghi thẻ giải thích, cần thêm một tool).
4. Mục không có câu nào thì nói rõ trên thẻ và chỉ cách nhờ Claude viết thẻ giải thích.

## Giữ luật của sakubun

- Web không tự soạn câu, không tự chấm. Tách từ, furigana, tra nghĩa, phát âm, tìm kho chung là công cụ cố định.
- Bảng học mới (`Script`) có `userId` bắt buộc, qua `userDb(userId)`. Kho chung là bảng riêng, không phải bảng học,
  không đọc chéo kho của ai. Migration chỉ cộng thêm.
- Lấy về và thêm từ từ Kaiwa tạo `Item` như các lối thêm hiện có; lịch FSRS chỉ đi qua `recordReviews()` (và tạo
  `SrsState` mới như kho OpenJLPT 7.2b đang làm).
- Logic thuần (parser, ghép furigana, chọn nghĩa, so bản sửa với bản gốc, gộp kết quả) tách khỏi truy vấn DB.
- Mỗi PR một mục đích, dưới khoảng 400 dòng, đổi UI thì kèm ảnh.

## Rủi ro

| Rủi ro | Cách chặn |
| --- | --- |
| Lộ dữ liệu riêng lên kho chung | Bản công khai là bản chụp ở bảng riêng, chỉ cột nội dung; test rằng ghi chú riêng, sao, lịch sử không bao giờ vào `LibraryEntry` |
| Rác hoặc nội dung xấu trên kho chung | Quản trị ẩn được (L6), giới hạn độ dài, mục ẩn theo tài khoản bị chặn |
| Người mới trống không biết bắt đầu đâu | Phân tích và Hướng dẫn chỉ thẳng tới "Lấy bộ N5" (L4); L4 chỉ làm khi L2 đã chạy |
| Từ điển kuromoji khoảng 20 MB làm ảnh Docker nặng, tách từ tốn RAM | Chỉ tách lúc lưu, giữ kết quả; nạp từ điển một lần khi cần |
| VOICEVOX chạy CPU trên NUC chậm với bài dài | Cache file âm thanh theo (câu, giọng, tốc độ); tải trước vài dòng |
| Mã Kaiwa cũ chỉ có một bản trên OneDrive | Chép phần cần vào repo ở K1–K5, kèm test |

## Câu hỏi cho thien

Đã trả lời hết (2026-10-27):

1. Chia sẻ theo **nhóm** (Nhóm đang có), xem luật 8.
2. Xoá tài khoản: theo đề xuất, xem luật 9.
3. Chỗ "hơi off": Ôn nhanh, xem phần C.
4. kaiwa-canvas cũ đã down (kiểm từ laptop 2026-10-27, mọi đường dẫn trả 404), có thể mất dữ liệu. Dữ liệu **còn**: bản lưu
   cuối trên laptop (`C:\Users\trann\nuc-final-backup-2026-10-09\kaiwa-canvas_canvas-data.tar.gz`, xem
   `nuc-infra/runbooks/01-reinstall-os.md`) có `scripts/scripts.json` với 5 kịch bản (kaiwa 5, Giới thiệu bản thân,
   Phỏng vấn, Con đường tới trường, Ngày hôm qua; tổng khoảng 50 dòng) và thư mục `yjs/` có thể giữ bản sửa mới hơn
   (scripts.json cập nhật lần cuối 10-06). K8 lấy bản mới nhất (đọc `yjs/` bằng `y-leveldb` nếu mới hơn), nhập vào
   kho của thien. File gốc có email nên không commit; chỉ nhập nội dung.
