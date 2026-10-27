# Kế hoạch phase 8: Kaiwa canvas và kho chung

- Ngày: 2026-10-27. Duyệt: chờ thien.
- Yêu cầu của thien (2026-10-27): làm **Kaiwa canvas** và các phần như **kho chung** trước 7.4 và các lỗi nhỏ;
  muốn Kaiwa có mặt sớm. Có bản Kaiwa sơ bộ thì sửa UI (7.4) và lỗi cùng lúc với các phần mới.
- Gốc: kế hoạch hợp nhất `nuc-infra/docs/research/2026-10-10-app-merge-plan.md`, giai đoạn 4 (Kaiwa): giữ tính
  năng của kaiwa-canvas, viết lại thành module trong sakubun, bỏ đồng biên tập realtime và đăng nhập Google riêng.

## Kaiwa canvas cũ có gì (đọc mã trên laptop, 2026-10-27)

Mã nằm ở OneDrive laptop (`Tài liệu/ChatGPT/japanese-script-canvas`), **không có commit, không có remote**, khoảng
85 KB mã nguồn, không có test. Vite + React 19, server Express 5.

| Phần | Bản cũ làm thế nào | Trong sakubun |
| --- | --- | --- |
| Định dạng kịch bản | Mỗi dòng `A: 日本語 \| tiếng Việt`; nhãn người nói 1–2 chữ Latin; dòng không nhãn là độc thoại; furigana tay `料理[りょうり]`; còn đọc được kiểu markdown cũ `**C:** …` + `**Tiếng Việt:** …` | Giữ nguyên định dạng, chép parser thành hàm thuần có test. Furigana tay trùng đúng cú pháp `parseFurigana` sakubun đang có |
| Soạn | CodeMirror 6, hai khung (bản thảo / xem), nút "Prompt cho AI" chép lời nhờ AI viết kịch bản | Bản sơ bộ dùng ô soạn thường (textarea chữ đơn cách); CodeMirror để tới đợt sửa UI. Giữ nút "Prompt cho AI" |
| Furigana tự động | Server dùng kuroshiro + kuromoji, mỗi dòng gọi một lần lúc xem | Tính một lần **lúc lưu**, lưu kèm kịch bản; dòng đã có `[..]` thì giữ của người soạn |
| Rê chuột tra nghĩa | kuromoji tách từ; nghĩa từ JMdict tiếng Anh + Google Translate (endpoint không chính thức) | Tách từ lúc lưu như trên. Nghĩa **tiếng Việt** lấy từ kho: mục của người học trước, rồi 7.739 nghĩa Việt của OpenJLPT có sẵn trong repo (`data/openjlpt/vi.json`). Không gọi Google. Có nút "Thêm vào kho" để từ đó vào lịch ôn |
| Nghe | `/api/tts` VOICEVOX, 22 giọng, client nhớ 24 đoạn, tải trước 8 dòng, dự phòng giọng trình duyệt | Dùng `/api/tts` sakubun đang có. Thêm **cache file âm thanh trên server** (kế hoạch hợp nhất, nguyên tắc 5), chọn giọng theo từng người nói |
| Karaoke | Chữ và furigana sáng dần theo tiến độ âm thanh; nghe cả bài | Giữ |
| Từng dòng | Ẩn/hiện, chép, phát; nghĩa Việt hiện khi rê/chạm; phím mũi tên, Enter để phát | Giữ |
| Thư viện kịch bản | Tạo, đổi tên, công khai/riêng, xoá; chủ = email | Thành bảng `Script` theo từng người học (như 7.1), cộng **kho chung** (dưới) |
| Đồng biên tập realtime (Yjs), ai đang xem, đăng nhập Google riêng | Có | **Bỏ**, như kế hoạch hợp nhất đã chốt |
| Lưu trữ | `scripts.json` + LevelDB của Yjs trong volume `canvas-data` | SQLite của sakubun. Kịch bản cũ trên NUC (nếu còn) nhập một lần, cần thien chép file ra |

## Kho chung

Hôm nay mỗi người học mới được **chép** 518 mẫu ngữ pháp OpenJLPT vào kho riêng (7.2b). Kế hoạch 7.1 đã để ngỏ
"sau này tách ra kho chung được".

Đề xuất cho đợt này (chờ thien xác nhận, câu hỏi 1):

- **Kịch bản Kaiwa chung**: kịch bản có cờ `shared`. Quản trị đánh dấu chung; mọi người học thấy ở tab "Kho chung"
  của trang Hội thoại, đọc, nghe, tra nghĩa được, và "Chép về kho của tôi" nếu muốn sửa. Không đổi bảng học cũ.
- **Ngữ pháp và từ vựng chung**: không làm trong đợt này. Muốn làm thì là việc schema lớn (tách `Item` thành
  catalog chung + phần riêng từng người), cần kế hoạch và sao lưu DB riêng. Tra nghĩa khi rê chuột đã dùng được
  7.739 từ OpenJLPT như một "kho tra cứu chung" mà không cần đổi schema.

## Giữ luật của sakubun

- Web không tự soạn câu, không tự chấm. Tách từ, furigana, tra nghĩa, phát âm là công cụ cố định, không phải dạy.
- Bảng mới `Script` có `userId` bắt buộc, mọi truy vấn qua `userDb(userId)`; migration chỉ cộng thêm.
- Thêm từ từ Kaiwa vào kho tạo `Item` như các lối thêm hiện có; lịch FSRS chỉ đi qua `recordReviews()`.
- Logic thuần (parser, ghép furigana, chọn nghĩa) tách khỏi truy vấn DB, có test.
- Mỗi PR một mục đích, dưới khoảng 400 dòng, đổi UI thì kèm ảnh.

## Các PR

"Kaiwa sơ bộ" = K1 tới K3: soạn, xem, nghe, furigana tự động. Có nó là bắt đầu đợt sửa UI và lỗi.

| PR | Nội dung | Rủi ro |
| --- | --- | --- |
| K1 | Bảng `Script` (migration cộng thêm, `userId` bắt buộc, cờ `shared`), parser thuần chép từ bản cũ + test | high (schema) |
| K2 | Trang **Hội thoại** `/kaiwa` (thanh bên): danh sách kịch bản, tạo/đổi tên/xoá; trang `/kaiwa/[id]` hai khung soạn và xem, thẻ từng dòng với furigana tay, nghĩa Việt khi rê/chạm, ẩn/hiện, phát qua `/api/tts`, nút "Prompt cho AI". e2e + ảnh | high |
| K3 | Furigana và tách từ tự động lúc lưu (kuromoji + kuroshiro chạy trên server; ảnh Docker kèm từ điển kuromoji) | medium |
| K4 | Rê chuột tra nghĩa theo từ: nghĩa Việt từ kho của người học rồi OpenJLPT; "Thêm vào kho" | high |
| K5 | Karaoke, nghe cả bài, giọng theo người nói, cache file âm thanh trên server | medium |
| K6 | Kho chung kịch bản: quản trị đánh dấu chung, tab Kho chung, chép về kho của tôi | high |
| K7 | MCP cho Claude: một tool để liệt kê, đọc và lưu kịch bản, và nhập vai theo kịch bản (giữ trong ngân sách token của `token-budget.test.ts`) | high |
| K8 | Nhập kịch bản cũ từ `scripts.json` của kaiwa-canvas (nếu thien còn file trên NUC) | high (dữ liệu) |

Sau K3: đợt sửa UI (7.4) và các lỗi trong STATUS, làm cùng các trang mới. K4 tới K8 xen vào theo thứ tự thien chọn.

## Rủi ro

| Rủi ro | Cách chặn |
| --- | --- |
| Từ điển kuromoji khoảng 20 MB làm ảnh Docker nặng thêm, tách từ tốn RAM | Chỉ tách lúc lưu, giữ kết quả; nạp từ điển một lần khi cần |
| VOICEVOX chạy CPU trên NUC chậm với bài dài | Cache file âm thanh theo (câu, giọng, tốc độ); tải trước vài dòng |
| Mã cũ chỉ có một bản trên OneDrive | Chép phần cần (parser, cách tô karaoke) vào repo ở K1–K5, kèm test |
| OpenJLPT chỉ phủ từ JLPT, từ ngoài danh sách không có nghĩa | Hiện cách đọc và "chưa có nghĩa"; thêm vào kho thì người học hoặc Claude điền nghĩa |

## Câu hỏi cho thien

1. Kho chung đợt này chỉ là **kịch bản Kaiwa dùng chung** (đề xuất), hay bạn muốn cả ngữ pháp/từ vựng thành kho
   chung (việc schema lớn, làm sau)? Hay ý bạn là người học tự chia sẻ kịch bản cho nhau?
2. "Những phần như kho chung, ..." còn gồm gì nữa? Ví dụ quiz từ vựng trên web (giai đoạn 3 của kế hoạch hợp nhất).
3. kaiwa-canvas cũ còn chạy trên NUC (`kaiwa.thientnse.site`) không, và có kịch bản nào đáng nhập (K8)?
