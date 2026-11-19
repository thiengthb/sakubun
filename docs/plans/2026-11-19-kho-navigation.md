# KN · Điều hướng trang Kho rõ ràng

Trạng thái: đang chạy · Duyệt: chưa · Cập nhật: 2026-11-19 · Thread: dự án Sakubun, thread "Tìm Kho bằng vẽ kanji" (nick tnt628)

Luật ghi file này ở `profile/PLANNING.md` của repo thienai-workflow. Tick khi có bằng chứng; đổi bước thì ghi vào "Đã đổi"; lỗi thì ghi vào "Lỗi gặp".

## Đang ở đâu

- Đang ở: KN1 (đường dẫn đúng và nút quay lại), code xong ở #344, chờ thien duyệt ảnh: https://claude.ai/artifact/AuzSsZe1wWUSKG2cfJ9Lu9 (mở ở nick tnt628).
- Còn thiếu: KN1, KN2, KN3.
- thien cần làm: duyệt ảnh của từng bước khi được gửi.

## Mục tiêu

thien (19/11): "đường dẫn, điều hướng của trang kho hơi khó để người dùng biết mình ở đâu… không biết mình đang đi đâu, quay lại như thế nào, có bao nhiêu luồng ở trang kho". Ở mọi màn của Kho, người học thấy ngay mình đang ở đâu, quay lại bằng một chạm, và biết Kho có mấy ngả.

## Kho hiện tại (main 487ec0d)

Thanh bên chỉ có một mục "Kho". Mọi màn dưới đây đều làm sáng mục đó.

| Ngả           | Màn                                                                                     | Đường dẫn trên đầu trang hiện nay | Vào từ đâu                             |
| ------------- | --------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
| Theo cấp JLPT | Bảng cấp (`/resources`)                                                                 | (không có)                        | thanh bên                              |
|               | Cấp, ví dụ N5 · Từ vựng (`/resources/level/N5/vocab`), 3 tab Chặng, Bản đồ ô, Danh sách | Kho                               | ô trên bảng cấp                        |
|               | Chặng (`/resources/level/N5/vocab/3`)                                                   | Kho › N5 · Từ vựng                | thẻ chặng                              |
| Ngoài JLPT    | Trang Ngoài JLPT (`/resources/outside`)                                                 | Kho                               | link nhỏ cuối bảng cấp                 |
|               | Một nguồn (`/resources/outside/manual`)                                                 | Kho › Ngoài JLPT                  | thẻ nguồn                              |
| Nhóm          | Bảng nhóm (`/resources/all?tab=groups`), một nhóm (`/groups/[id]`)                      | Kho › Nhóm                        | link nhỏ cuối bảng cấp                 |
| Mọi mục       | Bảng mọi mục (`/resources/all`), 4 tab Ngữ pháp, Từ vựng, Kanji, Nhóm                   | (không có)                        | link nhỏ cuối bảng cấp                 |
| Kanji         | Tab Kanji của Mọi mục, một chữ (`/resources/kanji/会`), bộ thủ (`/resources/radicals`)  | Kho › Kanji                       | tab Kanji của Mọi mục                  |
| Kho chung     | Trang Kho chung (`/library`), mục, nhóm, kanji theo cấp, kịch bản                       | Kho chung                         | nút Lấy, ô tìm, vài link trong màn cấp |
| (chung)       | Một mục (`/resources/[id]`), Sửa                                                        | Kho › Từ vựng (hoặc Ngữ pháp)     | mọi ngả trên                           |

Chỗ làm lạc đường:

1. **Đường dẫn không khớp đường đã đi.** Mở 会う từ N5 · Từ vựng › Chặng 3 thì trang 会う ghi "Kho › Từ vựng", và "Từ vựng" dẫn sang bảng Mọi mục chứ không về Chặng 3. Kanji và Nhóm cũng dẫn về bảng Mọi mục.
2. **Không thấy Kho có mấy ngả.** Ngoài JLPT, Nhóm, Mọi mục chỉ là link nhỏ cuối bảng cấp; Kanji nằm trong một tab của Mọi mục; Kho chung không có lối cố định nào.
3. **Kho chung như một nơi khác hẳn.** Đường dẫn ở đó chỉ ghi "Kho chung", không có lối về Kho.
4. **Trên điện thoại** đường dẫn là chữ nhỏ ở đầu trang, không có nút quay lại rõ ràng.

## Phương án (KN0, thien chọn)

- **A. Sửa đường dẫn, thêm nút quay lại.** Giữ nguyên cấu trúc. Mọi màn có đường dẫn đầy đủ theo đúng đường đã đi (Kho › N5 · Từ vựng › Chặng 3 › 会う); trên điện thoại thay bằng nút "‹ Chặng 3". Sửa được lỗi 1, 3, 4, chưa sửa lỗi 2.
- **B. Hàng ngả của Kho ở đầu mọi màn Kho** [đề xuất]. Gồm A, thêm một hàng cố định dưới tiêu đề: Theo cấp · Ngoài JLPT · Nhóm · Kanji · Kho chung, ngả đang đứng được tô. Điện thoại vuốt ngang hàng này. Mọi mục thành nút "Xem dạng bảng" trong Theo cấp.
- **C. Kho mở rộng trong thanh bên** [thien chọn 19/11 16:26Z, trên trang chọn https://claude.ai/artifact/2sHn59iuGi9qsbvFGjwkXA; AI đã đề xuất B]. Gồm A, thanh bên laptop xổ Kho thành 5 mục con như cây thư mục; điện thoại bấm tab Kho ra một trang chọn ngả trước khi vào bảng cấp.

## Không làm

- Không đổi nội dung từng màn (bảng cấp, chặng, ô tìm), chỉ đổi cách đi giữa các màn.
- U4g, U4h vẫn để sau kỳ thi N2.

## Checkpoint

### 0. Chọn phương án

Xong khi: thien chọn trên trang chọn, lựa chọn ghi vào file này.

- [x] Sơ đồ Kho hiện tại và các chỗ làm lạc đường (#343)
- [x] thien chọn C (19/11)

### 1. KN1 · Đường dẫn đúng chỗ, nút quay lại trên điện thoại

Xong khi: ở mọi màn Kho, đường dẫn ghi đúng chỗ của màn trong cây Kho, bấm vào đâu về đúng đó; điện thoại có nút "‹ <màn cha>".

- [x] Một cây Kho duy nhất (logic thuần, có test): với mỗi đường dẫn trang, biết ngả (Theo cấp JLPT, Ngoài JLPT, Nhóm, Kanji, Kho chung) và chuỗi màn cha. Trang một mục suy ra chỗ của mục: mục có cấp JLPT về Cấp › Chặng chứa nó, mục ngoài JLPT về Ngoài JLPT › nguồn.
- [x] Mọi màn Kho dùng cây đó cho đường dẫn (sửa trang mục, kanji, nhóm, Kho chung đang trỏ về bảng Mọi mục hoặc không có lối về Kho).
- [x] Điện thoại: chữ nhỏ đầu trang thành nút "‹ <màn cha>".
- [ ] Ảnh duyệt laptop và điện thoại (nguồn ở `2026-11-19-kho-navigation/kn1/`), e2e: các spec đụng đường dẫn chạy 19/11, 9 test đỏ y hệt trên main nên không do KN1.

### 2. KN2 · Kho xổ ra trong thanh bên laptop

Xong khi: thanh bên laptop có Kho với 5 mục con, mục con của ngả đang đứng được tô.

- [ ] Nhóm và Kanji có trang danh sách riêng (`/groups`, `/resources/kanji`), lấy từ tab của bảng Mọi mục; bảng Mọi mục thành nút "Xem dạng bảng" ở Theo cấp JLPT.
- [ ] Thanh bên: Kho › Theo cấp JLPT, Ngoài JLPT, Nhóm, Kanji, Kho chung, tô theo cây Kho.
- [ ] Ảnh duyệt, e2e.

### 3. KN3 · Trang chọn ngả trên điện thoại

Xong khi: bấm tab Kho trên điện thoại ra trang 5 ngả (kèm số mục), vào ngả nào cũng có nút "‹ Kho" về trang này.

- [ ] Trang chọn ngả, tab Kho trỏ về đó trên điện thoại; laptop giữ bảng cấp.
- [ ] Ảnh duyệt, e2e.

## Đã đổi

| Ngày  | Đổi gì                                                                        | Vì sao                                                                                                                                                                                                              |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19/11 | Chọn C thay vì B AI đề xuất                                                   | thien chọn trên trang chọn                                                                                                                                                                                          |
| 19/11 | Đường dẫn theo chỗ của màn trong cây Kho, không theo đường đã đi như bản A tả | Một mục tới được từ nhiều nơi (ô tìm, nhóm, Mọi mục, Kho chung); chỗ cố định thì đường dẫn đoán trước được, còn về đúng màn vừa rời đã có nút Back của trình duyệt. Thấy khó dùng thì thêm lối "về chỗ vừa rời" sau |

## Lỗi gặp

| Ngày  | Lỗi                                               | Đã xử lý                                                                                                   |
| ----- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 19/11 | Ảnh chụp đầu tiên: 飲む (N5) hiện dưới Ngoài JLPT | Server mới chưa nạp Kho chung khi mở trang mục; trang mục và trang sửa gọi `ensureOpenJlptLibrary()` trước |
