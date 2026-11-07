# C. Thói quen và động lực

## C1. Thói quen hình thành thế nào

- Lally và cộng sự (2010): 96 người tự chọn một hành vi hằng ngày. Trung vị **66 ngày** để hành vi đạt gần mức tự động,
  dao động **18 đến 254 ngày**. **Bỏ một ngày không làm hỏng thói quen** đáng kể. **Vừa** (mẫu nhỏ, tự báo cáo, chỉ
  39 người có số liệu khớp tốt).
- Thói quen bám vào **tín hiệu và bối cảnh ổn định**: cùng giờ, cùng chỗ, sau cùng một việc (Wood và Neal 2007).
  **Mạnh.**
- **Ý định thực hiện** ("Khi [tình huống] thì tôi sẽ [hành động]", ví dụ "Khi lên xe buýt buổi sáng thì tôi ôn 10
  thẻ"): meta-analysis của Gollwitzer và Sheeran (2006) cho hiệu quả vừa đến lớn lên việc thực sự làm. **Mạnh.**

Hệ quả cho Sakubun:

1. Lúc bắt đầu (hoặc trong Cài đặt), hỏi người học **khi nào và ở đâu** họ sẽ học, gắn với một việc có sẵn trong
   ngày. Nhắc đúng lúc đó.
2. Chuỗi ngày (streak) **phải có khoảng ân hạn**: bỏ một ngày không mất chuỗi. Bằng chứng nói bỏ một ngày không hại
   thói quen, nhưng mất chuỗi thì người học hay bỏ luôn.
3. Có **phiên tối thiểu** rất nhỏ (ví dụ 5 thẻ hoặc 1 câu) để những ngày bận vẫn giữ được thói quen.

## C2. Động lực: tự chủ, năng lực, gắn kết

Thuyết tự quyết (Deci và Ryan): người ta bền bỉ khi thấy **tự chọn** (tự chủ), **thấy mình tiến bộ** (năng lực) và
**có người cùng đường** (gắn kết). Phần thưởng bên ngoài kiểu điểm, huy hiệu có thể làm giảm hứng thú tự thân nếu
người học cảm thấy bị điều khiển (Deci, Koestner và Ryan 1999). **Mạnh.**

Meta-analysis về game hoá trong giáo dục (Sailer và Homner 2020): hiệu quả nhỏ đến vừa lên kết quả học (g khoảng
0,49), động lực (0,36) và hành vi (0,25); hiệu quả phụ thuộc mạnh vào cách thiết kế. **Vừa.**

Hệ quả:

- **Năng lực**: cho người học thấy tiến bộ có nghĩa thật: "Bạn đã biết 640 trên 800 từ N4", "Bạn đọc được 92% từ
  trong bài này", "Tháng trước bạn sai は/が 40%, tháng này 15%". Đây tốt hơn điểm kinh nghiệm (XP).
- **Tự chủ**: người học chọn chủ đề, độ dài, mục tiêu ngày. Sakubun đã có nhiều cài đặt; cần đặt chúng ngay tại
  lúc học thay vì giấu trong Cài đặt.
- **Gắn kết**: Kho chung là mầm của cộng đồng. Có thể thêm học cùng nhóm bạn nhỏ (2–5 người) thấy nhau đã học hôm
  nay chưa. Cần cân nhắc quyền riêng tư.

## C3. Bài học từ Duolingo

Số liệu Duolingo tự công bố (blog, không có kiểm định thống kê):

- Hiệu ứng mừng chuỗi ngày làm người mới quay lại sau 7 ngày tăng 1,7%.
- Cho giữ 2 "đóng băng chuỗi" làm số người học hằng ngày tăng 0,38%, không làm người học nghỉ nhiều hơn.
- Người đạt chuỗi 7 ngày có khả năng học xong khoá cao gấp 3,6 lần (tương quan, không phải nhân quả).

**Phản biện**: tất cả là số đo **tương tác**, không phải số đo **học được**. Duolingo tối ưu cho người dùng mở app,
và nhiều người học tiếng Nhật trên Duolingo nhiều năm vẫn không nói được. Chuỗi ngày dựa vào **nỗi sợ mất mát**: hiệu
quả cho việc mở app nhưng dễ thành áp lực và làm cho xong (làm bài dễ nhất để giữ chuỗi). **Yếu** cho kết quả học.

Hệ quả: lấy cái tốt (chuỗi ngày có ân hạn, nhắc đúng lúc, mục tiêu nhỏ) và **đếm việc học thật** (đã nhớ lại, đã
nói, đã viết), không đếm việc mở app.

## C4. Những mẫu thiết kế cần tránh (dark patterns)

- Thông báo gây tội lỗi ("Bạn làm cú buồn rồi").
- Bán lại chuỗi ngày đã mất.
- Bảng xếp hạng đẩy người học làm bài dễ cho nhiều điểm.
- Ẩn nút dừng thông báo.

## C5. Nợ ôn và cảm giác thất bại

Xem B8. Thiết kế thói quen phải tính trước ngày người học nghỉ: quay lại phải dễ, không bị phạt bằng đống thẻ.

## C6. Kênh nhắc

Sakubun là PWA. Web Push chạy trên Android và trên iOS từ 16.4 nếu đã thêm vào màn hình chính. Ngoài ra Sakubun có
profile MCP `planner` (`get_review_load`) cho bot xếp lịch đọc số lượng ôn. Câu hỏi cho thien: bạn muốn được nhắc qua
đâu (thông báo điện thoại, Telegram, Zalo, email, lịch Google)?

## Lý lẽ phản đối mạnh nhất

Người học tự giác (như thien, người tự xây app) có thể thấy mọi cơ chế thói quen là phiền. Vì vậy mọi thứ ở đây nên
**bật tắt được** và mặc định nhẹ nhàng.

## Nguồn

- Lally, P. và cộng sự (2010). How are habits formed. *European Journal of Social Psychology* 40(6). Tóm tắt phản biện: https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit
- Wood, W. và Neal, D. (2007). A new look at habits and the habit–goal interface. *Psychological Review* 114(4).
- Gollwitzer, P. và Sheeran, P. (2006). Implementation intentions and goal achievement: a meta-analysis. *Advances in Experimental Social Psychology* 38.
- Deci, E., Koestner, R. và Ryan, R. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin* 125(6).
- Sailer, M. và Homner, L. (2020). The gamification of learning: a meta-analysis. *Educational Psychology Review* 32.
- Duolingo: How the streak builds habit. https://blog.duolingo.com/how-duolingo-streak-builds-habit
