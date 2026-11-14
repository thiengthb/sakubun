# Kế hoạch U2: buổi ôn

Trạng thái: đang chạy · Duyệt: 2026-11-13 (bố cục C) · Cập nhật: 2026-11-13 · Thread: Claude, project `chan_0145cot…`,
"Đọc bàn giao và làm tiếp Sakubun"

Thuộc [UI v2](2026-11-08-ui-v2.md), giai đoạn 2 (mục "Từng màn hình › 2. Phiên ôn" và B4, B5, B7). Luật ghi file này ở
`profile/PLANNING.md` của repo thienai-workflow. Tick khi có bằng chứng; đổi bước thì ghi vào "Đã đổi"; lỗi thì ghi vào
"Lỗi gặp".

## Đang ở đâu

- Đang ở: xong cả 5 checkpoint (U2a–U2g: #291–#294, #302–#304, merge 14/11).
- Còn thiếu: điểm 1–5 cho màn tổng kết (chưa có).
- thien cần làm: không còn gì cho U2.

## Mục tiêu

Buổi ôn dễ nhìn và nhanh tay trên cả laptop lẫn điện thoại, mà vẫn nằm trong khung app như mọi trang khác.

## Không làm

- Buổi ôn toàn màn (ẩn sidebar, ẩn thanh tab, cột giữa màn): thien bác ngày 13/11.
- Đổi lịch FSRS hay cách tính điểm trong U2a đến U2d.
- Hoàn tác nhiều bước.

## Bố cục đã chọn (thien, 13/11, phương án C)

So sánh ba phương án có ảnh: https://claude.ai/artifact/AcSByXq14dJSa3fogfUBSP (A khung chuẩn, B cột hẹp giữa màn,
C thẻ trái và bảng phải).

- Giữ sidebar trên laptop, thanh tab trên điện thoại, đầu trang như các trang khác: tên trang, "Còn N thẻ", nút X
  "Dừng ôn" ở cuối hàng; dưới đó là thanh tiến độ chia đoạn, trải hết chiều ngang.
- Màn từ 1280px: hai cột. Trái là thẻ và các nút trả lời hoặc chấm. Phải là một bảng rộng 256px, dính khi cuộn:
  số thẻ đã nhớ, chưa nhớ, còn lại, rồi phím tắt của bước đang làm.
- Nút trả lời và nút chấm ở màn từ 1280px nằm ngay dưới thẻ, canh mép phải, không dính đáy cửa sổ; thẻ dài hơn
  màn thì nút vẫn dính đáy (thien chọn cách 1 ngày 14/11 sau khi duyệt U2a vòng 2: nút ở góc dưới bên phải trông lệch;
  so sánh: https://claude.ai/artifact/56oMmdZhHEuP4DwqZdXtrt).
- Laptop hẹp hơn 1280px: một cột như điện thoại, không có bảng, vì cạnh sidebar bốn nút chấm cần cả chiều ngang.
- Điện thoại: một cột, không có bảng; nút trả lời và nút chấm nằm cuối màn, ngay trên thanh tab.

## Checkpoint

### 1. U2a: khung buổi ôn theo bố cục C

Xong khi: thien duyệt ảnh 390 và 1440 (trước và sau), thấy sidebar hoặc thanh tab vẫn còn và bảng bên phải đúng số.

- [x] Đầu trang chuẩn, thanh tiến độ có `aria-valuenow`, nút X (#291)
- [x] Bảng bên phải: nhớ, chưa nhớ, còn, phím tắt; ẩn dưới 1280px (#291)
- [x] Enter trên một nút đang được chọn (như "Dừng ôn") không chấm thẻ giới thiệu (#291, góp ý CodeRabbit)
- [x] e2e: laptop có sidebar và bảng, điện thoại có thanh tab và thanh nút nằm trên nó (#291; thien duyệt ảnh vòng 2 và 3 ngày 14/11, merge cùng ngày)

### 2. U2b: đáp án trong tầm ngón cái, câu dịch dưới câu

Xong khi: thien duyệt ảnh 390 và 1440.

- [x] Chuyển #292 về `main` sau khi #291 merge, sửa theo bố cục C, chụp lại ảnh (thien duyệt 8/8 ngày 14/11; chọn xong thì đáp án dời lên dưới câu)

### 3. U2c: nút chấm dưới thẻ

Xong khi: thien duyệt ảnh 390 và 1440.

- [x] Chuyển #293 về `main` sau khi #292 merge; phím tắt chuyển vào bảng bên phải (ảnh 390 và 1440 giống hệt `main` từng điểm ảnh, 14/11, nên không cần vòng duyệt)

### 4. U2d: màn tổng kết

Xong khi: thien chấm màn tổng kết trên ảnh 390 và 1440.

- [x] Chuyển #294 về `main` sau khi #293 merge; bảng bên phải ở màn tổng kết hiện kết quả cuối (thien duyệt 6/6 ngày 14/11)

### 5. U2e, U2f: chấm chạy nền và hoàn tác (chỉ khi thien đồng ý)

Xong khi: e2e đi hết một phiên chỉ bằng bàn phím, kể cả hoàn tác; thẻ sau hiện dưới 400ms sau khi chấm, đo trong e2e.

- [x] U2e chấm chạy nền (risk:high, có migration cộng thêm): #302, thien merge 14/11; review sau merge nêu hai điểm, sửa ở U2f
- [x] U2f hoàn tác một bước (risk:high): giữ lần chấm cuối trên máy, nút Hoàn tác cạnh nút X, phím Z; đóng trang thì
      gửi bằng `sendBeacon`; rời phiên trong app thì gửi nốt; câu điền chỗ trống không hoàn tác được (đáp án đã hiện).
      #303, thien duyệt ảnh 390 và 1440 (trước, sau khi bấm Hoàn tác) 4/4 OK ngày 14/11, thien merge cùng ngày
- [x] U2g tự sang thẻ khi chọn đúng ở câu điền chỗ trống (mục 3 bên dưới): #304, code và e2e xong 14/11; thien duyệt ảnh 390 và 1440 2/2 OK, merge cùng ngày

## Đã chọn: chấm chạy nền, hoàn tác, tự sang thẻ

thien chọn "Đồng ý cả ba đề xuất" trên thẻ chọn ngày 14/11 (gửi lần đầu 13/11, gửi lại 14/11). Chi tiết:

1. **Chấm chạy nền (U2e).** Bấm chấm là sang thẻ sau ngay, lần chấm gửi lên server ở phía sau. Gửi lỗi thì giữ trên máy,
   tự gửi lại và báo nhỏ "Chưa lưu 2 thẻ". Mỗi lần chấm mang một mã do máy tạo, lưu trong `ReviewLog` (cột tuỳ chọn
   mới, migration chỉ cộng thêm), để gửi lại không ghi hai lần. Bước ghi lịch chỉ chạy khi `reps` và `state` của thẻ còn
   như lúc đọc. Lịch FSRS vẫn tính ở server qua `recordReviews()`. Chỗ yếu: mạng hỏng cả lúc đóng trang thì lần chấm
   chưa gửi mất, thẻ vẫn đến hạn như chưa ôn.
2. **Hoàn tác một bước (U2f).** Lần chấm gần nhất giữ trên máy tới khi chấm thẻ kế tiếp hoặc rời phiên; nút hoàn tác
   ở đầu trang, phím Z. Server không phải sửa `ReviewLog`. Lần chấm cuối gửi bằng `sendBeacon` qua route POST mới
   `/api/review/answer`.
3. **Tự sang thẻ khi chọn đúng ở câu điền chỗ trống**, sau 1,2 giây; chọn sai thì đứng lại chờ "Tiếp".

## Đã đổi

| Ngày  | Đổi gì                                                               | Vì sao                                                               |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 13/11 | Bỏ buổi ôn toàn màn; giữ khung app, chọn bố cục C                    | thien bác bố cục toàn màn khi đã có 4 PR, rồi chọn C từ ba phương án |
| 13/11 | Bỏ xếp chồng #291 → #294; mỗi PR chuyển về `main` khi PR trước merge | Luật "một bước, một nick, một PR" trong `CLAUDE.md` (#297)           |
| 13/11 | Viết lại kế hoạch theo `PLAN.template.md`; phần U1 đã nằm ở #297     | Áp quy trình chung                                                   |

## Lỗi gặp

| Ngày  | Lỗi                                                                                                                      | Đã xử lý                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| 13/11 | Code U2a đến U2d theo một dòng kế hoạch mà thien chưa thấy bằng ảnh                                                      | Thêm luật đưa 2–3 bố cục trước khi code (#297) |
| 14/11 | U2e: điều kiện "`due` còn như lúc đọc" từ chối lần chấm khi ngày trong SQLite viết kiểu khác (e2e `bottom-nav` bắt được) | So `reps` và `state` thay cho `due` (#302)     |
