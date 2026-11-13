# Bàn giao cho phiên ở tài khoản khác

Viết ngày 2026-11-13 bởi Claude (project "Sakubun" trên claude.ai, tài khoản chính của thien). Phiên ở tài khoản khác
không thấy thread, bộ nhớ dự án, artifact hay thư mục project files của tài khoản này, nên mọi thứ cần biết nằm ở đây.
Đọc theo thứ tự: `CLAUDE.md` → `docs/STATUS.md` → file này → `docs/roadmap.md` → kế hoạch của bước định làm.

Trạng thái đúng nhất luôn là `docs/STATUS.md` và PR đang mở; file này giữ phần không đổi theo ngày: cách thien làm việc
và những luật thien đã nói mà chưa có test nào giữ. Khi file này lệch với code, test hay `docs/ui-standard.md`, cái kia đúng.

## 1. Đang ở đâu (2026-11-13)

- `main` ở #287. Xong: lõi FSRS, nhiều người học (phase 7), Kaiwa và Kho chung (phase 8), kanji KJ1–KJ7 (phase 9),
  luyện dịch R1–R4, UI v2 U0. U1 (khung app) code đã merge hết (#276–#287); thien bỏ bước đi thử trên điện thoại.
- PR đang mở lúc viết, cả hai do phiên ở tài khoản khác mở hôm nay:
  - #288 `docs/u2-plan`: đánh U1 Done, nhận U2 (Phiên học), kế hoạch `docs/plans/2026-11-13-u2-study-session.md`
    với ba câu hỏi cho thien. Không merge trước khi thien đọc mục "Cần bạn chọn". U2a–U2d làm trước; U2e, U2f chờ.
  - #289 `docs/2026-11-13-research-answers`: đóng câu hỏi nghiên cứu, mục 6b của
    `docs/plans/2026-11-04-feature-candidates.md` là danh sách chọn việc sau UI v2.
- Sau U2: U3 Hôm nay → U4 Kho (D6 đã chốt: một menu "Kho" có tab Ngữ pháp/Từ vựng/Kanji, mỗi tab và Hội thoại có công tắc
  "Của bạn | Kho chung"; chép về kho riêng chỉ khi bấm Học/Sửa/nhập vai) → U5 Hội thoại → U6 Kho chung + Ctrl K → U7
  Tiến độ, Cài đặt, đăng nhập, lỗi, Admin → U8 dọn và khoá luật. Chi tiết ở `docs/plans/2026-11-08-ui-v2.md`.
- Cỡ chữ nội dung 17px (D5) chờ làm theo từng trang ở U4–U7, không làm một PR quét cả app (thien chốt 2026-11-09).

### Những mục cũ đã xong, đừng làm lại

Các ghi chú cũ có thể nhắc tới chúng; tất cả đã xong hoặc không còn đúng:

- #284 (thanh 5 tab) và patch `/progress` (thành #285) đã merge. Không còn patch nào chờ đẩy.
- Nhánh `kj2` "chờ #259": KJ2–KJ7 đã merge từ 08/11.
- Trang duyệt ảnh U1 cũ (artifact `TedjKZtwMf2QQhZ5msNexj`) đã thay bằng `9Hd8pSLPK63CUFMcX4Tshx`, và thien đã cho qua cổng U1.

### Việc treo đã biết

- e2e không chạy trong CI. `e2e/style-audit.spec.ts` đỏ trên main khi chạy sau kaiwa/quick-review (nợ ghi trên dữ liệu
  rỗng, cần PR riêng). `quick-review` "mất kết nối" / "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ, chạy riêng thì xanh.
- Tabs Base UI cần Enter hoặc Space mới chọn khi di bằng phím mũi tên (`activateOnFocus` tắt). Chưa hỏi thien; nếu thien
  muốn chọn ngay khi di phím thì bật `activateOnFocus` trong `components/ui/tabs.tsx`.
- Khoảng 14 component còn gọi server action thẳng, không qua `callAction`, nên mất mạng thì vỡ (settings, groups,
  resources, kaiwa-canvas, admin). Đổi dần theo trang ở U4–U7.
- Chờ thien (cũng có trong STATUS): bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản với tài khoản thứ hai.

## 2. Cách thien làm việc

- thien viết tiếng Việt; trả lời tiếng Việt, câu đủ, ngắn. thien là người học (thi N2 tháng 12/2026, yếu nghe và nói).
- thien quyết cái gì và vì sao; AI làm và chứng minh nó chạy. Việc lớn (hành vi học, schema, kiến trúc) viết kế hoạch
  ngắn, thien duyệt rồi mới code; kế hoạch duyệt rồi chép vào `docs/plans/`.
- Nhãn rủi ro (`nuc-infra/AGENTS.md`): `risk:low` AI merge khi CI xanh; `risk:medium` cần một phiên Claude khác review
  rồi mới merge; `risk:high` thien merge. Review chéo: PR mở dưới tài khoản GitHub của thien nên phiên review không
  APPROVE được; nó đăng một review COMMENT mở đầu bằng "Review: OK" hoặc "Review: CHANGES REQUESTED" kèm những gì đã kiểm.
- **Mọi PR đổi UI chờ thien duyệt ảnh trước/sau ở 1440 và 390 rồi mới merge**, kể cả khi đã có Review: OK.
- `main` xanh CI thì NUC tự deploy trong khoảng 2 phút. Vì vậy merge là đưa lên production thật.
- Codex chỉ làm DỮ LIỆU (dịch câu ví dụ, nghĩa kanji…), không bao giờ viết code. Việc dữ liệu nặng thì viết brief cho
  Codex trong `docs/codex/` (xem hai brief có sẵn), dặn Codex tách nhánh từ `main` mới nhất cho mỗi lô.
- Sakubun chỉ là web, responsive từ laptop xuống điện thoại; không có app native. Thanh 5 tab dưới đáy điện thoại là
  lựa chọn D2 của thien cho web hẹp, không phải dấu hiệu sắp làm app.
- thien hay dùng gói Claude miễn phí: số token của mô tả công cụ MCP và kết quả công cụ là chi phí thật, giữ nhỏ.
- Hỏi một lần, đề xuất một lựa chọn. Khi thien hỏi "tính năng còn chạy không", trả lời câu hỏi, đừng tự đi sửa.
- thien nhớ những gì đã duyệt và đã xin; lặp lại một lỗi thien đã chỉ làm thien bực. Đọc mục 3 trước khi chụp ảnh.

### Trang duyệt ảnh (mỗi vòng duyệt UI)

thien duyệt từng cặp ảnh trên một trang HTML (artifact claude.ai). Mỗi trang phải có:

- Danh sách kịch bản ở đầu trang: rỗng / đầy / một / rất nhiều / chữ rất dài / số 0 / số rất lớn, tìm không thấy, lọc đang
  bật, chọn nhiều, menu dòng đang mở, mọi tab, sheet lọc trên điện thoại, mọi đường đi từ trang (thêm, sửa, chi tiết).
- Mỗi cặp ảnh: nút OK / Cần sửa và ô ghi chú. Cuối trang: ghi chú chung, ô kết quả có nút "Chép", nút "Gửi cho Claude"
  ghi vào db của artifact (`reviews/<trang>-rN`). Nháp giữ trong localStorage.
- Lưới dùng ảnh thu nhỏ JPEG (tối đa 800px); bấm vào mở trình xem toàn màn: đổi Trước/Sau tại chỗ, Vừa màn/100%/200%,
  OK/Cần sửa đồng bộ với thẻ, trước/sau, Esc.
- **Mỗi vòng là một trang mới** chỉ chứa ảnh của vòng đó; không nối vòng mới vào trang cũ.
- Dữ liệu chụp phải giống kho thật (cách đọc, Hán Việt, có mục ngữ pháp); nhãn ảnh nói đúng cái ảnh cho thấy.

## 3. Gu và luật UI thien đã nói

Phần lớn đã thành test hoặc nằm trong `docs/ui-standard.md` và `docs/plans/2026-11-08-ui-v2.md`; đọc chúng trước.
Dưới đây là phần chủ yếu sống qua ảnh và lời thien.

**Hướng chung.** Khung như Notion (phẳng, gọn), giọng như Duolingo (đậm, màu nhấn sáng, nút nổi có viền dưới, bấm thì
lún), màu Claude (nền kem, primary đất sét). Không thích: Linear, Things 3, Settings của iPhone, Raycast; bo góc quá
tròn, nút quá to trên laptop, chữ cắt quá sớm, nút chỉ có icon khó đoán, cỡ chữ nhảy lung tung, chữ đậm quá ở nút/chip.
Dùng component và token của thienui (`thiengthb/thienui`); primitive chỉ trong `components/ui`.

**Kích thước.** Nút 36px trên điện thoại, 28px từ 768px; icon trong nút 16px; vùng chạm 44px trên màn cảm ứng bằng
hit-area, không phóng to phần nhìn thấy. Viền điều khiển 2px cùng màu, không viền tối 1px. Bán kính điều khiển 8px.

**Danh sách.** Điện thoại luôn cuộn để tải thêm, không phân trang. Laptop có phân trang; chân bảng nằm sát đáy cửa sổ,
khoảng trống dư nằm trên nó; thanh dính không bao giờ che phân trang. Bảng một trang thì ẩn số dòng mỗi trang. Lịch sử /
Tiến độ là danh sách thẻ ở mọi bề rộng (dữ liệu khác loại nhau), thẻ cùng cỡ, ghi chú dài không làm một thẻ to hơn.
Điểm chỉ hiện số ("61"), "61/100" khi rê chuột. Tên nhóm và ghi chú tối đa 2 dòng.

**Thẻ, menu, bộ lọc.** Thẻ kiểu Duolingo (viền 2px, nổi). Menu và popover kiểu Duolingo, luôn nằm trọn trong màn hình,
mép phải thẳng với nút mở. Số bộ lọc đang bật là chấm màu thương hiệu ở góc phải trên của nút. Tiêu đề sheet đậm kèm icon;
nút đặt lại trông như nút. Trạng thái được chọn: nền nhạt phủ tới mép, chỉ nổi nhẹ, không viền primary đậm.

**Form.** Thêm/sửa luôn là trang, không phải dialog. Nút Lưu/Tạo tắt cho tới khi có thay đổi và đủ trường bắt buộc;
trường bắt buộc có dấu * đỏ và chú thích. Không báo lỗi "Cần nhập…"; lỗi dưới ô chỉ cho luật nghiệp vụ, ngắn ("Tối đa 20
ký tự, đang có 25"). Giải thích không nằm trong ô; đặt trong "Hướng dẫn" gập dưới form. Nút tạo chỉ ghi "Thêm".

**Đang tải và trạng thái cả trang.** Một luật cho mọi skeleton: đầu trang viết chữ thật (tên trang chính xác: "Sửa ngữ
pháp", "Sửa từ vựng"), chỉ phần chờ dữ liệu là thanh xám. Trang lỗi / không thấy / link hỏng: nội dung ra giữa màn, icon
lớn thể hiện lỗi, ít chữ (`PageState`).

**Học.** Thẻ lật có 4 mức Quên / Khó / Nhớ / Dễ. Ô đáp án kiểu Duolingo, chữ giữa; chỉ đáp án là thẻ, câu hỏi không có
khung. Đáp án có Hán Việt và ví dụ. Hán Việt luôn viết hoa trong ngoặc vuông: [TIỀN]. Flashcard nhóm như Quizlet: mặt
trước chỉ có từ, nút nhỏ (lùi, tới, lật, trộn), nhớ tiến độ. Bỏ câu giải thích người học tự hiểu ("Đúng, tính là Nhớ").
Một nút đơn (Xem đáp án) ngắn trên laptop, rộng hết trên điện thoại. Nội dung trải hết khung trang trên laptop.

**Đầu trang.** Đầu trang nhiều thông tin cần thoáng ở cả hai bề rộng. Loại trang (ngữ pháp / từ vựng / hỗn hợp) là chip
đứng đầu dòng meta. Trang cấp trên không chừa dòng đường dẫn trống; trang lồng giữ đường dẫn. Mục đang mở ở sidebar: viền
xám như thẻ người dùng, chỉ chữ màu cam. Nút đọc to luôn canh giữa theo dòng chữ bên cạnh.

**Khi thien chê "đẹp hơn".** Đưa tinh chỉnh nhỏ hoặc hai phương án để chọn, đừng làm lại cả kiểu (vòng Lịch sử 2: bản tô
màu đầy đủ bị chê "quá xấu", thien muốn bản gọn ban đầu).

## 4. Ghi chú kỹ thuật hay vấp

- e2e trong container cloud: dùng một config Playwright tạm có `launchOptions.executablePath: '/opt/pw-browsers/chromium'`
  (không commit). Chụp ảnh bằng một spec tạm `e2e/zz-*.spec.ts`, bỏ ra trước `npm run verify` (lint bắt helper thừa).
- Chạy `npm install` trên một checkout cũ có thể gỡ `@base-ui/react`; cài lại sau khi đổi nhánh. Trước verify xoá cả `.next`.
- Base UI: dùng `data-open`/`data-closed`, không có `data-state`; tooltip không có `role=tooltip` (wrapper tự thêm); dialog
  mở từ menu trả focus về nút menu; dialog đóng có hoạt ảnh giữ focus, e2e phải chờ dialog biến mất rồi mới gõ phím.
- Chiều cao dòng phải là số px tròn (rem), nếu không các e2e "chân bảng" / "hàng đều" lệch 1px.
- Hoạt ảnh CSS dùng token `--p-motion-duration-*`; vẽ vòng dữ liệu bằng `conic-gradient`, không vẽ `<svg>` tay.
