# Kế hoạch Kaiwa: giọng từng vai, lưu buổi nhập vai

- Ngày: 2026-11-07. Bản thảo cho thien: https://claude.ai/artifact/8cLPNMpfZ9doRXbaiTHFHm
- Duyệt: thien, 2026-11-07 19:46 UTC, cả bốn câu theo đề xuất: (1) giọng chọn cho một vai thắng giọng trong Cài đặt,
  kể cả vai của anh; (2) mỗi buổi nhập vai một thẻ trong Lịch sử ("thử theo đề xuất"); (3) Claude tự lưu khi hết bài;
  (4) câu chưa đúng chưa đưa vào Ôn nhanh.
- Khi làm c1 (2026-11-07): giọng đã chọn của một vai không còn trong kịch bản (sau khi đổi tên vai) bị bỏ qua khi đọc,
  không xoá khỏi cột.

Hai việc Kaiwa còn lại theo thứ tự anh chọn (a, b, c, d). (a) Claude tìm và lấy kịch bản chung qua MCP, và (b) karaoke theo âm tiết đã code xong, không đổi schema. (c) và (d) đều thêm cột hoặc bảng, nên theo luật của repo em xin anh duyệt trước khi code.

## (c) Chọn giọng cho từng vai

**Hôm nay:** vai "Tôi là" dùng giọng trong Cài đặt; các vai khác tự nhận giọng theo thứ tự xuất hiện, nam nữ xen kẽ. Anh không đổi được giọng của một vai.

**Đề xuất:**

- Trên trang kịch bản, menu Thao tác có thêm mục "Giọng từng vai". Mục này mở hộp thoại, mỗi vai một hàng: tên vai, ô chọn giọng (danh sách giọng VOICEVOX như trong Cài đặt) và nút nghe thử câu đầu tiên của vai đó.
- Vai nào chưa chọn thì giữ cách tự gán như hôm nay. Vai nào đã chọn thì luôn dùng giọng đó, kể cả khi anh đang đóng vai ấy.
- Lựa chọn lưu theo từng kịch bản của anh. Khi anh chia sẻ kịch bản lên Kho chung, giọng không đi theo; người lấy về tự chọn.
- Schema: thêm một cột `voices` (JSON, ví dụ `{"A": 3, "B": 13}`) vào bảng `Script`. Migration chỉ cộng thêm, không đụng dữ liệu cũ.
- Server kiểm: tên vai phải có trong kịch bản, mã giọng phải nằm trong danh sách giọng. Sai thì trả lỗi ngắn. Sửa giọng không tăng `version` của kịch bản, vì `version` dùng để chặn ghi đè nội dung.

## (d) Lưu buổi nhập vai vào Lịch sử

**Hôm nay:** khi nhập vai với Claude, Claude chỉ sửa trong chat. Đóng chat là mất, Lịch sử không có gì.

**Đề xuất:**

- Thêm tool MCP `kaiwa_roleplay_save`. Hết bài, Claude gọi tool này với `scriptId`, vai của anh, và từng câu anh nói. Mỗi câu gồm số lượt, câu anh nói, đúng ý hay chưa, và một dòng nhận xét.
- Thêm bảng mới `Roleplay`, có `userId` bắt buộc như mọi bảng học. Mỗi buổi là một dòng: kịch bản, vai, các câu (JSON), số câu đúng ý, thời điểm.
- Lịch sử có thêm thẻ "Nhập vai". Mỗi buổi là một thẻ gọn ghi tên kịch bản, vai và "7/9 câu đúng ý". Bấm vào thẻ mở hộp thoại: từng lượt hiện câu mẫu, câu anh nói và nhận xét, câu chưa đúng được tô màu. Có nút "Mở kịch bản" và "Nhập vai lại" (chép câu nhờ như nút hiện có).
- Không đụng lịch ôn FSRS: kịch bản không phải mục học, nên buổi nhập vai không ghi `ReviewLog`.
- Server kiểm: kịch bản phải của chính anh, vai phải có trong kịch bản, số lượt phải là lượt của vai anh, câu nói không được rỗng, tối đa 60 lượt. Sai thì trả lỗi ngắn nêu cách sửa.
- Thêm một dòng vào kết quả của `kaiwa_roleplay`: "At the end, call kaiwa_roleplay_save". Mô tả tool vẫn nằm trong ngân sách token (hiện khoảng 1.520 trên 2.000).

## Các PR

| PR | Nội dung | Kiểm | Rủi ro |
| --- | --- | --- | --- |
| c1 | Cột `voices`, hàm thuần chọn giọng có ưu tiên lựa chọn của anh, lưu qua server action | test logic thuần và test lưu | high (schema) |
| c2 | Hộp thoại "Giọng từng vai" trong menu Thao tác, nghe thử | e2e, ảnh trước/sau 1440 và 390 | medium |
| d1 | Bảng `Roleplay`, tool `kaiwa_roleplay_save`, luật server | test MCP client, ngân sách token, thử thật trong claude.ai | high (schema, MCP) |
| d2 | Thẻ "Nhập vai" trong Lịch sử và hộp thoại chi tiết | e2e, ảnh trước/sau 1440 và 390 | medium |

## Câu hỏi cho anh

1. **(c) Giọng chọn cho vai của anh có thắng giọng trong Cài đặt không?** Đề xuất: có, chọn cho kịch bản nào thì kịch bản đó dùng giọng ấy.
2. **(d) Lịch sử hiện thế nào?** Đề xuất: mỗi buổi một thẻ, bấm vào xem từng câu. Cách khác là mỗi câu một thẻ, dùng lại thẻ "Hội thoại" hiện có và không cần bảng mới, nhưng một buổi 10 câu sẽ thành 5 thẻ và làm loãng Lịch sử.
3. **(d) Claude lưu tự động hay hỏi anh trước?** Đề xuất: tự động lưu khi hết bài, rồi báo "đã lưu vào Lịch sử" kèm link. Đây là dữ liệu của chính anh và không đổi lịch ôn.
4. **(d) Câu chưa đúng có đưa vào Ôn nhanh không?** Đề xuất: chưa. Trước mắt chỉ hiện trong Lịch sử; làm thêm sau nếu anh thấy cần.

