# Cách thien làm việc ở Sakubun

Phần không đổi theo ngày, cho mọi nick Claude và Codex: cách thien làm việc, những luật UI thien đã nói mà chưa có test giữ,
và những điều trước đây chỉ nằm trong bộ nhớ của từng nick. Trạng thái (đang ở đâu, ai giữ việc gì) chỉ nằm ở
`docs/STATUS.md` và PR đang mở, không ghi ở đây. Khi file này lệch với code, test hay `docs/ui-standard.md`, cái kia đúng.
Đọc theo thứ tự: `AGENTS.md` → `CLAUDE.md` → `docs/STATUS.md` → file này → `docs/roadmap.md` → kế hoạch của bước định làm.

## 1. Những điều trước đây chỉ có trong bộ nhớ của từng nick

- **Hướng sản phẩm**: Sakubun cho nhiều người học tiếng Nhật người Việt, có thể thu phí sau này. Không dùng AI phía server
  (tốn phí API) cho tới khi có gói trả phí; AI là thầy qua MCP. Không có dữ liệu nào bắt buộc phải giữ (dựng lại được).
- **thien là người học**: đỗ N3 tháng 7/2026 (117/180), thi N2 tháng 12/2026, yếu nghe và nói, học thất thường, Hán Việt rất
  mạnh. Phần dùng nhiều nhất là luyện dịch. Chi tiết ở mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- **Đăng ký và chặn** (7.2): tài khoản Google nào cũng đăng ký được, không cần duyệt; chủ chặn được bất cứ lúc nào. Chặn là
  khoá, xoá là một thao tác riêng có xác nhận. Quản trị là tài khoản khớp `ALLOWED_EMAIL` trên NUC (`/admin`).
- **Kaiwa còn lại** (thien chọn thứ tự, chưa vào lộ trình): tìm kịch bản qua MCP, karaoke theo âm tiết, giọng riêng từng vai,
  lưu buổi nhập vai.
- **Repo công khai** từ 27/10 vì GitHub Actions bị chặn thanh toán khi để riêng tư; CI chạy trên `ubuntu-latest`. Không bao
  giờ dùng runner tự host khi repo công khai.
- **Merge**: chế độ tự động của Claude chặn merge nếu thien chưa nói rõ trong thread (ví dụ "merge đi"). Đó là chủ ý.

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

Dựng bằng mẫu so sánh chung ở thienai-workflow, không tự viết trang mới:
[`artifacts/compare/`](https://github.com/thiengthb/thienai-workflow/blob/main/artifacts/compare/README.md). Gắn repo
thienai-workflow vào phiên, viết `round.json` cạnh ảnh, rồi chạy lệnh trong bản clone của thienai-workflow (đường dẫn
`round.json` và `out` là đường dẫn tới thư mục ảnh của vòng): `node artifacts/compare/make-round.mjs <round.json> <out>`, rồi
đăng `out/index.html` theo đúng README đó. Mẫu đã có sẵn: danh sách kịch bản ở đầu trang, Trước/Sau cạnh nhau hoặc trượt,
Vừa màn/100%/200%, OK / Cần sửa từng màn, ghim comment đúng chỗ trên ảnh, ghi chú chung, "Chép kết quả", "Gửi cho Claude",
kết quả lưu ở db của trang (`reviews/<id vòng>`) và nháp trong máy.

Phần riêng của sakubun khi dựng vòng:

- `id` vòng đặt `<trang>-rN` (ví dụ `history-r2`). **Mỗi vòng là một trang mới** chỉ chứa ảnh của vòng đó; không nối vòng
  mới vào trang cũ.
- Ảnh ở 1440 và 390 cho mọi màn đổi. `scenarios` liệt kê đủ: rỗng / đầy / một / rất nhiều / chữ rất dài / số 0 / số rất
  lớn, tìm không thấy, lọc đang bật, chọn nhiều, menu dòng đang mở, mọi tab, sheet lọc trên điện thoại, mọi đường đi từ
  trang (thêm, sửa, chi tiết).
- Dữ liệu chụp phải giống kho thật (cách đọc, Hán Việt, có mục ngữ pháp); nhãn ảnh nói đúng cái ảnh cho thấy.
- Trang duyệt và db của nó chỉ nick tạo ra đọc được. Kết quả thien chọn (OK / Cần sửa, ghi chú, comment ghim) phải chép vào
  PR ngay khi nhận.
- Cần thien chọn một trong vài hướng (bố cục, luồng) thay vì duyệt trước/sau: dùng mẫu
  [`artifacts/decide/`](https://github.com/thiengthb/thienai-workflow/blob/main/artifacts/decide/README.md).

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
- Nợ đã biết: khoảng 14 component còn gọi server action thẳng, không qua `callAction`, nên mất mạng thì vỡ (settings,
  groups, resources, kaiwa-canvas, admin); đổi dần theo trang ở U4–U7. Tabs Base UI cần Enter hoặc Space mới chọn khi di
  phím mũi tên (`activateOnFocus` tắt), chưa hỏi thien. Cỡ thân chữ 17px (D5) làm theo từng trang ở U4–U7, không quét cả app.
