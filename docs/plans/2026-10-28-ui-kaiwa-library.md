# Kế hoạch 7.4 (đợt 1): làm lại Hội thoại và Kho chung

- Ngày: 2026-10-28. Trạng thái: **chờ thien duyệt**.
- Bước 7.4 của `docs/roadmap.md` ("mỗi trang mới hoặc đổi theo UI mới, một PR một trang, thien duyệt ảnh trước và
  sau"). Đợt này làm hai trang mới của phase 8 trước, theo lời thien (2026-10-28): "tiếp đến làm lại giao diện trang
  kaiwa, kho chung". Các lỗi nhỏ trong STATUS đi kèm ở cuối.
- Mong muốn của thien về Kaiwa (2026-10-27), đã có bản thô ở K3b, K3c, K5: thẻ kiểu tin nhắn, vai "Tôi là" bên trái,
  người khác bên phải, dòng không có người nói là bối cảnh ở giữa, sửa trên web, rê chuột xem nghĩa.
- Ảnh bản hiện tại (dev, dữ liệu OpenJLPT thật, một kịch bản 10 câu ba người nói) ở
  `docs/plans/2026-10-28-ui-kaiwa-library/before-*.png`, 1440 và 390. Vòng tròn chữ N ở góc dưới trái là nút của
  Next dev, không có trên production.
- Không đổi schema, không migration. Mọi PR theo `docs/ui-standard.md` (bốn khuôn trang, nút 28/36px, bo 8px,
  popover cách mép 16px) và trả nợ `ui-standard-debt.json` của trang mình đụng.

## Hội thoại: chỗ chưa ổn

Ảnh: `before-kaiwa-list-*`, `before-kaiwa-script-*`, `before-kaiwa-word-1440`, `before-kaiwa-edit-*`.

1. **Danh sách chỉ có tên và ngày.** Không biết bài dài bao nhiêu, ai nói, nội dung gì. Ở 1440 năm thẻ chiếm một
   phần ba trang, phần còn lại trống.
2. **Hai trục lệch nhau ở 1440.** Cột chat rộng tối đa 768px dồn trái, nên bong bóng "bên phải" dừng ở giữa trang
   (x khoảng 1050), trong khi nút đầu trang nằm sát mép phải (1415).
3. **"Tôi là" mặc định là người nói đầu tiên**, thường là người bán hàng (店員). Người học phải đổi ở mỗi bài mới.
4. **Dấu người nói nặng hơn câu thoại.** Viên tròn đen hay xám đậm với tên ba chữ (グエン) là thứ đậm nhất trang, và
   màu đen, xám của người khác lẫn với nút.
5. **Nút loa chiếm một cột trong bong bóng.** Ở 390 chữ chỉ còn khoảng 230px, câu vừa phải đã gãy ba dòng.
6. **Chỉ đọc được.** "Ẩn nghĩa" là nút ở đầu trang; không có cách che câu của vai mình để tự nói trước (luyện nói),
   không bật tắt furigana ngay trên trang (phải vào Cài đặt).
7. **Bảng nghĩa che dòng phía trên** và hàng "Tôi là" (`before-kaiwa-word-1440`), vì mở lên trên.
8. **Trang sửa là một ô chữ.** Ở 390 dòng dài cuộn ngang và không thấy câu nào là của ai; lỗi định dạng chỉ hiện sau
   khi bấm Lưu.

## Hội thoại: đề xuất

**Trang kịch bản** (`/kaiwa/[id]`):

- Cột chat lấp đầy vùng nội dung, bong bóng rộng tối đa 65% (laptop) hoặc 85% (điện thoại), nên bong bóng bên phải
  thẳng mép với nút đầu trang.
- **Thanh công cụ dính** ngay dưới đầu trang, đi theo khi cuộn: `Tôi là [店員] [グエン] [田中]` · `Ẩn nghĩa` ·
  `Che câu của tôi` · `あ` (furigana, nhớ trên máy). Đầu trang chỉ còn `Sửa` và `Sửa với AI`, nên trên điện thoại
  đầu trang còn hai nút thay vì ba.
- **Che câu của tôi** (mới, luyện nói): câu của vai mình thành bong bóng mờ ghi nghĩa tiếng Việt và "Bấm để xem";
  bấm thì hiện câu tiếng Nhật. Không chấm điểm, không ghi gì vào lịch ôn (chấm thuộc về AI, K8 nhập vai).
- **Dấu người nói nhẹ đi**: tên viết chữ nhỏ (12px, màu mờ) phía trên bong bóng đầu mỗi lượt, như chat nhóm; bỏ
  viên tròn. Màu phân vai nằm ở nền bong bóng: vai mình cam nhạt như hôm nay, mỗi người khác một nền trung tính
  riêng (xám, xanh xám, be), đủ tương phản cả nền sáng và tối.
- **Loa ra ngoài bong bóng**, ở phía trống (bong bóng trái thì loa bên phải nó, và ngược lại), nên chữ có hết bề
  rộng bong bóng.
- **"Tôi là" mặc định**: tên đã chọn ở bài gần nhất nếu bài này có tên đó (ví dụ luôn là グエン), không thì người nói
  đầu như hôm nay. Mỗi bài vẫn nhớ lựa chọn riêng.
- Bảng nghĩa mở xuống dưới từ, không che hàng phía trên; chạm trên điện thoại mở cùng bảng đó.
- Bối cảnh giữ ở giữa, chữ 12px mờ, không đổi.

**Danh sách** (`/kaiwa`): mỗi thẻ có câu tiếng Nhật đầu tiên (một dòng, cắt bớt), số câu, các vai (chữ mờ:
"店員 · グエン · 田中") và ngày cập nhật. Có ô tìm theo tên khi có từ 9 bài trở lên. Trạng thái trống giữ nguyên.

**Trang sửa** (`/kaiwa/[id]/edit`, `/kaiwa/new`): laptop chia hai cột, ô chữ bên trái, **xem trước** bên phải dựng
bằng đúng thẻ chat của trang kịch bản (chưa có furigana tự động, vì furigana tính khi lưu). Điện thoại có hai tab
`Viết` và `Xem trước`. Dòng sai định dạng hiện lỗi ngay dưới ô, kèm số dòng ("Dòng 4: thiếu dấu |"), thay vì chờ Lưu.

## Kho chung: chỗ chưa ổn

Ảnh: `before-library-groups-*`, `before-library-items-*`, `before-library-group-*`.

1. **Tab Nhóm là mười thẻ gần giống nhau** ("Toàn bộ ngữ pháp N5 của OpenJLPT."), chip loại lặp lại đúng chữ trong
   tên ("Ngữ pháp" và "N5 · Ngữ pháp"). Không biết mình đã lấy bao nhiêu mục của mỗi nhóm. Nhóm do người học đăng
   sẽ lẫn xuống cuối danh sách này.
2. **Từng mục chỉ hiện 50 mục đầu**, và meta ghi "50 mục" như thể cả kho chỉ có 50. Không có trang tiếp hay sắp xếp.
3. **Không xem được một mục trước khi lấy.** `data/openjlpt/examples.json` (phần C) đã có câu ví dụ, câu dịch,
   furigana và cách nối tiếng Việt, nhưng Kho chung chỉ hiện tên và nghĩa. Tên mẫu còn nhãn tiếng Anh của nguồn:
   `〜が（subject）`, `〜に（place of existence）`.
4. **Mỗi thẻ có sáu thứ**: loa, Lấy, nghĩa, "loại · cấp · nguồn", Ẩn (quản trị), tim. Trong trang nhóm "N5 · Ngữ
   pháp", dòng "Ngữ pháp · N5 · OpenJLPT" lặp lại 81 lần. Nút Ẩn của quản trị nằm trên mọi thẻ, sát nút tim, dễ bấm
   nhầm.
5. **Đầu trang nhóm ở 390 chật**: tiêu đề gãy hai dòng vì "Lấy cả nhóm" chung hàng; dòng "Quản trị · Ẩn" chen giữa
   đầu trang và mô tả.
6. **Trang nhóm tải và vẽ hết một lần**, không tìm được trong nhóm: N1 Từ vựng là 2.962 thẻ.

## Kho chung: đề xuất

**Tab Nhóm** (`/library`): hai phần.

- **OpenJLPT theo cấp**: một bảng gọn, mỗi hàng một cấp (N5 tới N1), hai ô Ngữ pháp và Từ vựng. Mỗi ô ghi số mục và
  thanh "Đã có 12/81" của người học; bấm vào mở trang nhóm. Bỏ chip loại và câu mô tả lặp.
- **Cộng đồng**: nhóm người học đăng, sắp theo lượt lấy rồi mới nhất, mỗi thẻ có tên, người đăng, số mục, lượt lấy,
  tim. Chưa có nhóm nào thì một dòng trống ngắn kèm cách đăng (Chia sẻ trong trang Nhóm của mình).

**Tab Từng mục**:

- Meta ghi tổng thật ("518 ngữ pháp, 7.625 từ vựng" hoặc "Khoảng 120 mục khớp"); nút `Xem thêm` tải thêm 50 mục.
- Thêm `Sắp xếp: Phổ biến | Mới` và công tắc `Ẩn mục đã có`.
- **Thẻ gọn**: tên mẫu sạch (nhãn tiếng Anh của nguồn thành chú thích nhỏ dịch sang tiếng Việt, `〜が` + "chủ ngữ",
  nếu `formationVi` hay bản dịch có; không thì giữ nguyên), nghĩa, một dòng meta, `Lấy`, tim. Ẩn của quản trị vào
  menu `...` của thẻ.

**Trang một mục** (mới, `/library/item/[id]`, khuôn Chi tiết): tên, nghĩa, cấp, cách nối (`formationVi`), một tới ba
câu ví dụ có furigana, dịch và loa (từ `examples.json`, câu `skip` không hiện), nhóm chứa mục này, lượt lấy và tim,
nút `Lấy` (hoặc `Đã có` tới mục của mình). Bấm thẻ ở Từng mục hay trong trang nhóm mở trang này. Không dùng hộp
thoại, vì `ui-standard` chỉ cho hộp thoại để xác nhận.

**Trang nhóm** (`/library/[id]`): đầu trang theo luật hiện có (chip loại đầu dòng mô tả), `Lấy cả nhóm` và tim; Ẩn
của quản trị vào menu `...`. Dưới đầu trang: thanh "Đã có 12/81" và `Lấy phần còn thiếu`, ô tìm trong nhóm, thẻ bỏ
dòng meta lặp, tải 60 mục một lần với `Xem thêm`.

## Thứ tự PR

Mỗi PR một trang, kèm ảnh trước và sau ở 1440 và 390 (sáng, thêm một ảnh tối), e2e cập nhật, `risk:high` theo
roadmap 7.4 (thien duyệt ảnh và merge). Không có migration.

| #    | PR                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------- |
| 7.4a | Trang kịch bản: bố cục, thanh công cụ dính, dấu người nói, loa ngoài bong bóng, Che câu của tôi, あ |
| 7.4b | Danh sách Hội thoại và trang sửa có xem trước, lỗi theo dòng                                        |
| 7.4c | Kho chung tab Nhóm (bảng OpenJLPT theo cấp, Cộng đồng) và trang nhóm                                |
| 7.4d | Kho chung Từng mục (Xem thêm, sắp xếp, ẩn mục đã có, thẻ gọn) và trang một mục                      |
| 7.4e | Lỗi nhỏ trong STATUS, mỗi lỗi một PR nhỏ (bên dưới)                                                 |

## Lỗi nhỏ đi kèm (7.4e)

Lấy từ "Việc nhỏ còn treo" trong `docs/STATUS.md`, làm sau 7.4a–d, theo thứ tự:

1. Thống nhất "Xoá" (bỏ "Xóa") trên toàn UI, thêm test chặn chữ cũ. `risk:low`.
2. Chữ của `status` (MCP) tách rõ "đến hạn" và "hạn mức ngày". `risk:medium`.
3. `recordReviews` gọi `invalidateStreak`, để chuỗi ngày cập nhật ngay. `risk:medium`.
4. e2e `critical-path` không phụ thuộc dữ liệu spec khác để lại. `risk:low`.
5. Trang đồng ý OAuth hiện email đang cấp quyền. `risk:high` (đụng OAuth).

## Cần thien chọn

Mỗi câu có đề xuất; thien không trả lời câu nào thì làm theo đề xuất.

1. "Che câu của tôi" làm ngay trong 7.4a, hay để dành cho K8 (AI nhập vai)? Đề xuất: làm ngay, vì không cần AI và
   là cách luyện nói đơn giản nhất.
2. "Tôi là" mặc định theo tên đã chọn ở bài gần nhất? Đề xuất: có.
3. Xem một mục Kho chung bằng trang riêng (khuôn Chi tiết) hay mở rộng ngay trong thẻ? Đề xuất: trang riêng, có
   đường dẫn gửi được và đủ chỗ cho câu ví dụ trên điện thoại.
