# Kế hoạch U2: phiên học

- Ngày: 2026-11-13. Thuộc `docs/plans/2026-11-08-ui-v2.md` (giai đoạn 2, mục "Từng màn hình › 2. Phiên ôn" và B4, B5, B7).
- thien bỏ qua bước thử U1 trên điện thoại (13/11) và cho làm U2 luôn.
- Phần giao diện đã nằm trong kế hoạch UI v2 thien duyệt ngày 8/11. Phần cần thien duyệt riêng là mục "Cần bạn chọn" ở
  dưới, vì nó đổi cách ghi điểm (risk:high theo `CLAUDE.md`).

## Hiện có gì

`/review` đã có:

- Nút X "Dừng ôn".
- Thanh tiến độ chia đoạn.
- Dòng "Còn N thẻ".
- Vòng làm lại các câu sai.
- Phím tắt.
- Màn "Xong buổi ôn": các ô số theo loại, Khó, Quên.

Phiên tải sẵn tối đa 20 thẻ ngay khi mở, nên phần "tải trước" của B4 gần như đã có.

Chỗ còn thiếu:

| Chỗ thiếu                                                  | Vì sao nó là vấn đề                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Mỗi lần chấm phải chờ server trả lời rồi mới sang thẻ sau. | Thường mất 100–300ms. Mạng yếu thì cả phiên đứng lại.                            |
| Không hoàn tác được khi lỡ bấm.                            | Bấm nhầm thì không sửa được.                                                     |
| Màn kết thúc chỉ có số.                                    | Không có chuỗi ngày, không có thẻ sai để xem lại, không có gợi ý việc tiếp theo. |
| Trên laptop sidebar vẫn hiện và cột học rộng theo trang.   | Chưa tách khỏi khung app như kế hoạch UI v2 muốn.                                |

## Các PR

| #   | Làm gì                                                                                                                                                                                             | Rủi ro |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| U2a | `SessionHeader` (X, thanh tiến độ có `aria-valuenow`, "còn N", chỗ cho nút hoàn tác); laptop ẩn sidebar trong phiên, cột 640px giữa màn                                                            | medium |
| U2b | `StudyCard` và `AnswerOption`: câu hỏi to ở khoảng 1/3 trên; điện thoại 4 đáp án xếp dọc sát đáy trong tầm ngón cái, laptop lưới 2×2 ngay dưới câu; chọn xong đáp án đúng sáng xanh, câu dịch hiện | medium |
| U2c | `GradeBar` cho thẻ lật (giữ 4 nút và thời gian chờ), dòng phím tắt dưới cùng                                                                                                                       | medium |
| U2d | Màn tổng kết: đã ôn, tỉ lệ nhớ, chuỗi ngày, tối đa 3 thẻ sai bấm vào xem lại, một việc gợi ý tiếp. Số liệu lấy từ chính phiên trên máy và `getStreak()`, không đụng schema (B7)                    | medium |
| U2e | Ghi điểm chạy nền (B4), nếu bạn đồng ý                                                                                                                                                             | high   |
| U2f | Hoàn tác lần chấm vừa rồi (B5), nếu bạn đồng ý                                                                                                                                                     | high   |

Thứ tự: U2a đến U2d làm trước, không đổi lịch FSRS hay cách ghi điểm; U2e và U2f chờ bạn duyệt mục dưới.

## Cần bạn chọn

**1. Ghi điểm chạy nền (U2e).**

- Bấm chấm là sang thẻ sau ngay. Lần chấm được gửi lên server ở phía sau.
- Gửi lỗi thì lần chấm được giữ trên máy và tự gửi lại. Màn hình báo nhỏ "Chưa lưu 2 thẻ".
- Gửi lại phải an toàn khi lần trước thật ra đã lưu, chỉ mất câu trả lời. Mỗi lần chấm mang một mã do máy tạo. Server
  thấy thẻ đã được chấm, và lần ghi mới nhất của thẻ đó mang đúng mã ấy, thì trả lại kết quả cũ như một lần lưu thành
  công, không báo lỗi. Mã nằm trong `ReviewLog` (một cột tuỳ chọn mới, migration chỉ cộng thêm). Đây là thay đổi schema
  duy nhất của U2.
- Hai lần gửi chồng nhau cho cùng một thẻ hiện vẫn có thể cùng được ghi: `answerCard()` đọc thẻ rồi mới ghi, và
  bước ghi trong `recordReviews()` không kiểm tra lại. U2e sửa chỗ này trước: bước ghi lịch chỉ chạy khi `due` và
  `state` của thẻ còn đúng như lúc đọc; lệch thì không ghi gì và trả về "đã chấm rồi".
- Khi bạn rời trang, mọi lần chấm còn giữ được gửi nốt.
- Lịch FSRS vẫn tính ở server, qua `recordReviews()` như cũ.
- Chỗ yếu: nếu cả mạng lẫn lần gửi nốt khi đóng trang đều hỏng, những lần chấm chưa gửi sẽ mất. Thẻ đó vẫn đến hạn như chưa ôn, nên không làm sai lịch, chỉ phải ôn lại.

**2. Hoàn tác (U2f), theo cách hoãn ghi đã nêu ở B5.**

- Lần chấm gần nhất được giữ trên máy cho tới khi bạn chấm thẻ kế tiếp, hoặc kết thúc hay rời phiên. Hết lúc đó mới gửi.
- Nút hoàn tác ở `SessionHeader`, phím tắt Z. Bấm vào thì bỏ lần chấm đang giữ và quay về thẻ trước.
- Hoàn tác chỉ bỏ lần chấm chưa gửi, nên server không bao giờ phải sửa `ReviewLog` hay lùi lịch của thẻ. Chống chấm
  hai lần là việc của bước ghi có điều kiện ở U2e.
- Chỉ hoàn tác được một bước.
- Lần chấm cuối được gửi bằng `sendBeacon` khi trang đóng. Việc này cần một route POST mới (`/api/review/answer`), dùng chung kiểm tra và `answerCard()` với server action hiện có.

**3. Tự sang thẻ khi chọn đúng ở câu điền chỗ trống.**

- Mình đề nghị tự qua sau 1,2 giây khi đúng, như kế hoạch UI v2.
- Chọn sai thì đứng lại, chờ "Tiếp", để bạn đọc đáp án và câu dịch.
- Trong 1,2 giây đó: Enter, Space hay chạm vào thẻ thì sang luôn; Z thì hoàn tác lần chọn vừa rồi, không sang thẻ;
  Tab và các phím khác giữ việc bình thường của chúng, không sang thẻ.

Mình đề nghị đồng ý cả ba.

## Cửa U2 (xong khi)

- e2e đi hết một phiên chỉ bằng bàn phím: điền chỗ trống, thẻ lật, thẻ kanji, vòng làm lại, hoàn tác, tổng kết.
- Thẻ sau hiện dưới 400ms sau khi chấm, đo trong e2e.
- Bạn chấm màn tổng kết theo thang 5 điểm, trên ảnh 390 và 1440.
