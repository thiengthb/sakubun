# Kế hoạch 7.4 (đợt 1): làm lại Hội thoại, Kho chung, Tài nguyên và Lịch sử

- Ngày: 2026-10-28. Trạng thái: **chờ thien duyệt vòng 2**. Vòng 1: thien trả lời ba câu (2026-10-28). Vòng 2: thien thêm
  sáu ý (Hội thoại một canvas, nút furigana ở sidebar, thẻ và cuộn tải thêm cho Tài nguyên, Kho chung, Lịch sử, nút
  chỉ có icon, furigana ở Lịch sử, tra nghĩa ở mọi câu tiếng Nhật, flashcard nhóm); phần "Vòng 2" bên dưới thay cho
  những chỗ cũ trái với nó.
- Mẫu để thien chọn: artifact "Mẫu giao diện 7.4 Sakubun" (https://claude.ai/artifact/LaXkUksJmqmQykq2t3VvCo, chỉ
  tài khoản của thien mở được); các quyết định chốt từ đó được chép vào file này.
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

## Vòng 1: thien trả lời (2026-10-28)

1. "Che câu của tôi" làm ngay: **theo đề xuất**.
2. "Tôi là" mặc định theo tên đã chọn ở bài gần nhất: **có**.
3. Xem một mục Kho chung bằng trang riêng: **theo đề xuất**.

## Vòng 2: ý mới của thien (2026-10-28)

Ảnh thêm: `before-resources-grammar-cards-*`, `before-resources-groups-1440`, `before-history-*`,
`before-group-flashcard-*`.

### 1. Hội thoại: xem và sửa trên một canvas

thien: trang sửa hợp nhất với trang xem như canvas cũ; ô sửa là editor đủ dùng, dựa trên editor của VS Code.

Canvas cũ (đọc mã trên laptop 2026-10-28, `OneDrive/Tài liệu/ChatGPT/japanese-script-canvas`): CodeMirror 6 tối giản
(chỉ số dòng, xuống dòng mềm, Tab chèn hai dấu cách; không hoàn tác, không tìm, không tô màu), lưới
`bản thảo | thanh kéo | xem` bật bằng Ctrl E, tỉ lệ kéo 25 tới 75% nhớ trên máy, điện thoại chuyển qua lại hai khung,
tự lưu sau 650ms. Phần đáng giữ nằm ở khung xem: karaoke, nghe cả bài, tải trước 8 câu, ↑ ↓ chọn câu và Enter để
nghe, ẩn từng câu.

Đề xuất (mẫu `Kaiwa-View`, `Kaiwa-Edit`, `Kaiwa-Phone`):

- Một trang `/kaiwa/[id]`. Mặc định là chế độ xem; `Sửa` (Ctrl E) mở khung bản thảo bên trái, xem trước bên phải,
  thanh kéo ở giữa (nhớ tỉ lệ trên máy). `/kaiwa/[id]/edit` chuyển về trang này ở chế độ sửa; `/kaiwa/new` mở thẳng
  chế độ sửa với bản trống.
- Editor CodeMirror 6 (`@codemirror/state`, `view`, `commands`, `search`, `language`, `autocomplete`, `lint`): số dòng,
  tô dòng đang đứng, hoàn tác và làm lại, Ctrl F tìm và thay, nhiều con trỏ (Alt bấm, Ctrl D), tô màu theo định dạng
  (tên người nói, chữ Nhật, dấu `|`, nghĩa Việt, `漢字[よみ]`), gợi ý tên người nói đã có khi gõ đầu dòng, lỗi định dạng
  gạch sóng ngay dòng đó kèm lời sửa (lấy từ parser server đang dùng), thanh trạng thái (dòng, cột, số câu, số lỗi).
- Xem trước dựng bằng đúng thẻ chat của chế độ xem. Con trỏ ở dòng nào thì câu đó viền cam bên xem trước; bấm một câu
  bên xem trước thì nhảy tới dòng đó (parser giữ số dòng nguồn cho mỗi câu).
- Lưu bằng nút `Lưu` hoặc Ctrl S, không tự lưu: mỗi lần lưu tính lại furigana, và giữ cơ chế số phiên bản để không ghi
  đè bản AI vừa lưu. Rời trang khi chưa lưu thì hỏi lại.
- Điện thoại: hai tab `Viết` và `Xem trước`; dòng tự xuống hàng; một hàng phím nhanh trên bàn phím chèn tên người nói
  đã có, `|` và `[ ]`.
- Chế độ xem theo phần "Hội thoại: đề xuất" ở trên, trừ nút あ (chuyển ra sidebar, ý 2). "Nghe cả bài" có karaoke là
  K6, làm ngay sau; thanh công cụ chừa chỗ.

### 2. Nút furigana ở sidebar, đổi kiểu nút giao diện

- Laptop: chân sidebar, cùng hàng với nút giao diện: hai nút icon cùng kiểu, cùng cỡ (あ và mặt trăng hoặc mặt trời);
  đang bật thì nền cam nhạt như lựa chọn khác; tooltip kèm phím tắt. Sidebar thu gọn thì hai nút xếp dọc. Điện thoại:
  hai nút ở chân menu tài khoản. Mẫu `Sidebar-Lookup`.
- Bật tắt đổi ngay mọi chữ trên trang đang mở (một context phía client, khởi tạo từ cài đặt) và lưu vào cài đặt của
  người học (`furiganaMode`, như công tắc hôm nay), nên đúng trên mọi máy.
- Bỏ công tắc Furigana trong Cài đặt. Bỏ các nút あ riêng lẻ trên trang (flashcard nhóm, Ôn nhanh nếu có).

### 3. Thẻ và cuộn tải thêm: Tài nguyên, Kho chung, Lịch sử

Luật chung cho mọi thẻ, hôm nay và sau này (trừ khi thien cho ngoại lệ), thêm vào `docs/ui-standard.md` và khoá bằng
test:

- Mỗi dòng chữ trên thẻ (tiêu đề, mô tả, nghĩa, câu) tối đa **một dòng**. Chữ bị cắt mới có tooltip hiện bản đầy đủ khi
  rê chuột hay focus; chữ vừa thì không. Một component dùng chung (`TruncateText`) đo tràn và chỉ gắn tooltip khi tràn.
- Danh sách thẻ **cuộn tải thêm** ở mọi bề rộng, như Tài nguyên hôm nay; bỏ phân trang ở chế độ thẻ (Lịch sử).
- Danh sách thẻ có **khung đang tải riêng** (thẻ xám đúng hình thẻ thật), không mượn khung của bảng.
- Ô chọn nhiều chỉ có ở chế độ bảng; chế độ thẻ không có ô chọn.

**Thẻ Tài nguyên (Ngữ pháp, Từ vựng)**: chip cấp đứng chỗ ô chọn cũ; bỏ dòng trạng thái; mục mới (chưa ôn lần nào) có
nhãn đỏ "Mới" đè lên viền trên, góc phải; sao xuống dưới, cùng cột với nút menu. Hai mẫu cho chỗ của loa:
**A** (theo thien) loa dưới chip cấp, cùng cột; **B1** (đề xuất) loa nhỏ màu nhạt bám ngay sau tiêu đề, cột trái chỉ
rộng bằng chip nên tiêu đề có thêm chỗ. **B2** là kiểu một hàng cho danh sách rất dài. Mẫu `Main`, `Resource-B`.

**Thẻ nhóm (Tài nguyên và Kho chung)**: tên và mô tả một dòng, tooltip khi bị cắt; số đứng trước tim; tác giả là
người thì có icon người trước tên.

**Thẻ từng mục Kho chung**: cột trái chip cấp và nguồn; cột phải `Lấy` (hoặc dấu tích "Đã có") và số rồi tim; "Ẩn" của
quản trị chuyển vào trang một mục. Mẫu `Library`.

**Lịch sử**: thẻ một dòng câu; chip cấp cạnh chiều dịch; bỏ chip "Dịch câu" (chỉ còn dịch câu) và số ký tự, giữ thời
gian làm. Hộp chi tiết: chip cấp bên phải chiều dịch, bỏ số ký tự và chữ "Đề", có nhãn "Nhận xét:", dòng cuối ghi
"Đối tượng:" với chip nói rõ ngữ pháp hay từ vựng. Mẫu **A** đúng các ý trên (`History-A`), mẫu **B** (đề xuất): dòng
thời gian theo ngày, mỗi lượt một dòng hai tầng gồm đề và bài bạn dịch, thanh màu kết quả mỗi ngày (`History-B`); chi
tiết **B** là ngăn bên phải với ← → chuyển lượt và bài bạn đặt cạnh đáp án (`History-Detail`).

### 4. Nút trên thẻ chỉ có icon

Nút trên thẻ chỉ là icon, rê chuột hay focus hiện tooltip nói hành động (Lấy về kho, Đã có trong kho, Thích, Đánh dấu
sao, Thao tác). Thêm vào `docs/ui-standard.md`, khoá bằng test: trong component thẻ, nút phải là nút icon có
`aria-label` và tooltip. Áp vào thẻ nhóm của Tài nguyên (thêm tooltip cho mô tả) và thẻ từng mục Kho chung (bỏ chữ
"Lấy", "Đã có", "Ẩn").

### 5. Furigana ở Lịch sử

Chế độ furigana bật thì câu tiếng Nhật trong thẻ và chi tiết Lịch sử hiện furigana luôn, không cần rê chuột.

### 6. Tra nghĩa ở mọi câu tiếng Nhật

Một component dùng chung (`JapaneseText`) thay chỗ hiện câu tiếng Nhật ở Hội thoại, Lịch sử, Ôn nhanh, Kho chung
(câu ví dụ) và chi tiết mục: furigana theo nút ở sidebar, từ có nghĩa được gạch chấm, rê chuột hoặc chạm mở bảng tra.

- Tách từ ở server (kuromoji đã có từ K4) một lần cho mỗi câu, có cache theo nội dung câu; Kaiwa vẫn lưu sẵn lúc lưu.
  Trình duyệt không tải từ điển.
- Nghĩa tiếng Việt: mục của người học trước, rồi Kho chung (OpenJLPT); từ đã chia tra theo dạng gốc. Nghĩa của cả
  trang tra trong một truy vấn, không gọi mỗi lần rê chuột.
- Bảng tra (mẫu `Sidebar-Lookup`): từ lớn, cách đọc, Hán Việt, từ loại, cấp; các nghĩa đánh số; dạng trong câu; nút icon
  Nghe, Lấy về kho hoặc Đã có, Chép. Mở xuống dưới từ sau 150ms, cách mép màn hình 16px.
- Test: tách từ và tra dạng gốc (đơn vị), e2e rê chuột ở Hội thoại, Lịch sử, Ôn nhanh.

### 7. Flashcard của nhóm

Bỏ nút あ không chạy và dòng "Chỉ để xem lại, không tính vào lịch ôn. Phím mũi tên để chuyển thẻ, phím cách để lật."
Thẻ cao theo màn hình (từ dưới tab tới trên hàng nút), không còn khoảng trống dưới đáy. Mẫu `Flashcard`.

### Lỗi thấy thêm khi chụp

- Tài nguyên ở 390: nút "Sắp xếp" tràn ra ngoài màn hình (`before-resources-grammar-cards-390`). Sửa trong PR thẻ
  Tài nguyên.

## Thứ tự PR (thay bảng cũ)

Mỗi PR một mục đích, ảnh trước và sau ở 1440 và 390, e2e cập nhật, `risk:high` theo roadmap 7.4 (thien duyệt ảnh và
merge). Không có migration.

| #    | PR                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.4a | Nền dùng chung: `TruncateText`, nút icon có tooltip, luật thẻ trong `ui-standard.md` và test; nút あ và nút giao diện ở sidebar, bỏ công tắc trong Cài đặt |
| 7.4b | Tra nghĩa dùng chung (`JapaneseText`, tách từ ở server có cache); áp vào Hội thoại, Lịch sử, Ôn nhanh                                                      |
| 7.4c | Thẻ Tài nguyên (Ngữ pháp, Từ vựng, Nhóm), khung tải của thẻ, bỏ ô chọn ở chế độ thẻ; flashcard nhóm                                                        |
| 7.4d | Lịch sử: cuộn tải thêm mọi bề rộng, thẻ và chi tiết mới, furigana                                                                                          |
| 7.4e | Hội thoại chế độ xem (thanh công cụ, dấu người nói, loa, Che câu của tôi, Tôi là mặc định)                                                                 |
| 7.4f | Hội thoại một canvas: editor CodeMirror 6 và xem trước, Ctrl E, Ctrl S, điện thoại hai tab                                                                 |
| 7.4g | Danh sách Hội thoại                                                                                                                                        |
| 7.4h | Kho chung tab Nhóm (bảng OpenJLPT theo cấp, Cộng đồng) và trang nhóm                                                                                       |
| 7.4i | Kho chung Từng mục (cuộn tải thêm từ server, sắp xếp, ẩn mục đã có) và trang một mục                                                                       |
| 7.4k | Nút chỉ có icon trên laptop: luật, test, nút đầu trang mọi trang (chi tiết ở vòng 3)                                                                       |
| 7.4j | Lỗi nhỏ trong STATUS, mỗi lỗi một PR nhỏ (bên dưới)                                                                                                        |

## Lỗi nhỏ đi kèm (7.4j)

Lấy từ "Việc nhỏ còn treo" trong `docs/STATUS.md`, theo thứ tự:

1. Thống nhất "Xoá" (bỏ "Xóa") trên toàn UI, thêm test chặn chữ cũ. `risk:low`.
2. Chữ của `status` (MCP) tách rõ "đến hạn" và "hạn mức ngày". `risk:medium`.
3. `recordReviews` gọi `invalidateStreak`, để chuỗi ngày cập nhật ngay. `risk:medium`.
4. e2e `critical-path` không phụ thuộc dữ liệu spec khác để lại. `risk:low`.
5. Trang đồng ý OAuth hiện email đang cấp quyền. `risk:high` (đụng OAuth).

## Vòng 2: thien chọn (2026-10-28)

1. Thẻ Tài nguyên: **B1** (loa nhỏ màu nhạt sau tiêu đề).
2. Lịch sử: **B** (dòng thời gian theo ngày) và chi tiết **B** (ngăn bên phải).
3. Hội thoại: lưu bằng nút và **Ctrl S**, không tự lưu.

## Vòng 3: ý mới của thien (2026-10-28)

### Hội thoại

- Một nút icon `?` ở cuối hàng nút đầu trang; rê chuột (hoặc focus, hoặc chạm trên điện thoại) hiện bảng mọi phím tắt
  của trang (Ctrl E sửa, Ctrl S lưu, ↑ ↓ chọn câu, Enter nghe, Ctrl F tìm...). Trong nút không ghi phím tắt nữa.
- Loa đặt sát bong bóng, phía trống, như nút bên cạnh tin nhắn của Messenger: icon nhỏ màu nhạt, đậm lên khi rê chuột
  vào câu; điện thoại luôn hiện.

### Sidebar thu gọn

Icon các mục bị lệch sang phải, không nằm giữa. Nguyên nhân: nút mục có viền 2px (cho trạng thái đang chọn) nên khi thu
gọn hộp 32px chỉ còn 12px cho icon 16px. Sửa trong 7.4a: bớt padding đúng 2px khi thu gọn, có e2e đo icon nằm giữa.

### Flashcard của nhóm

Thẻ thấp lại như cũ (không kéo cao hết màn hình); giữ vị trí thẻ, thanh tiến độ và hàng nút như mẫu `Flashcard`.

### Nút chỉ có icon trên toàn app (laptop)

thien: mọi nút thành icon trên laptop. Nút ở vùng tiêu đề co lại thành icon, rê chuột thì giãn ra hiện chữ (nút
`ExpandingIconButton` đã có, hôm nay chỉ dùng cho Thêm, Lọc, Sắp xếp). Nút trong nội dung chỉ là icon, rê chuột hiện
tooltip mô tả. Điện thoại không rê được: nút có icon ai cũng hiểu (thêm, sửa, xoá, lọc, sắp xếp, tìm, đóng, chép...) chỉ
icon; nút ít gặp thì ghi chữ.

Đề xuất cách làm:

- Luật trong `docs/ui-standard.md`, khoá bằng test. Ở laptop mọi nút đầu trang là `ExpandingIconButton`; nút trong
  nội dung là nút icon có tooltip. Chữ hiện trên điện thoại hay không thì code tự quyết theo icon: icon thuộc
  `PLAIN_ICONS` (danh sách icon ai cũng hiểu, đã có) thì chỉ icon, icon khác thì kèm chữ. Không để mỗi chỗ tự chọn.
- Giữ chữ ở hai chỗ: nút chính màu cam của trang (Lưu, Luyện nhóm, Lấy cả nhóm), vì đó là việc người học tìm đầu tiên;
  và nút trong hộp xác nhận và biểu mẫu (Huỷ, Xoá vĩnh viễn), vì việc không hoàn tác được phải ghi rõ bằng chữ.
- Rê chuột hay focus bằng bàn phím đều giãn nút; giãn ra thì đẩy các nút bên trái, không đè lên.
- PR riêng **7.4k** ngay sau 7.4a: luật, test và nút đầu trang của mọi trang (một chỗ chung trong `PageShell`).
  Nút trong nội dung đổi dần trong PR của từng trang (7.4c tới 7.4i).

## Vòng 3: thien chọn (2026-10-28)

Nút chỉ có icon: nút chính màu cam và nút trong hộp xác nhận **vẫn ghi chữ**. Không còn câu nào chờ chọn.
