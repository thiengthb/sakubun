# Kế hoạch K6: nghe cả bài Kaiwa, giọng theo người nói, cache âm thanh

- Ngày: 2026-10-31. Duyệt: thien, 2026-10-31 02:57 ("theo đề xuất"): không chọn giọng cho từng vai, dừng để tự nói
  ở dòng bị che, karaoke theo âm tiết để sau K6c.
- Gốc: hàng K6 trong `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md` ("Karaoke, nghe cả bài, giọng theo
  người nói, cache file âm thanh trên server", rủi ro medium). thien chọn thứ tự K9, K6, K8, K7 ngày 2026-10-31.

## Hôm nay app làm gì

- Mỗi dòng có nút loa riêng (`SpokenLine` gọi `SpeakButton`). Bấm thì gọi `/api/tts`, VOICEVOX trên NUC đọc câu,
  và chữ sáng dần theo tỉ lệ thời gian đã phát (karaoke tuyến tính: mọi chữ dài bằng nhau).
- Mọi dòng dùng một giọng, là giọng trong Cài đặt (`voiceSpeaker`). A và B nghe giống hệt nhau.
- Không có nút nghe cả bài: muốn nghe hội thoại thì bấm từng dòng.
- `/api/tts` gọi VOICEVOX mỗi lần trình duyệt chưa có bản trong cache của nó. VOICEVOX chạy CPU, một câu dài mất
  vài giây, nên khi nghe liền nhiều câu sẽ có khoảng lặng chờ.

## Đề xuất

### K6a. Cache âm thanh trên server

- `/api/tts` lưu file WAV đã đọc vào volume dữ liệu (`/data/tts-cache/`), tên file là mã băm của (câu, giọng,
  tốc độ). Lần sau cùng câu, cùng giọng thì trả file ngay, không gọi VOICEVOX.
- Giới hạn tổng dung lượng (đề xuất 300 MB). Vượt thì xoá các file lâu không dùng nhất.
- Không phải bảng học, không có migration, không đổi gì người học thấy, chỉ nhanh hơn. Tính khoá và chọn file cần
  xoá là logic thuần, có test.

### K6b. Giọng theo người nói

- Người học (vai "Tôi là") dùng giọng trong Cài đặt như hôm nay.
- Mỗi người nói khác tự nhận một giọng khác, theo thứ tự xuất hiện trong kịch bản, lấy từ danh sách giọng sẵn có
  (`VOICE_SPEAKERS`) và xen nam, nữ để dễ phân biệt. Cùng một kịch bản thì luôn ra cùng giọng.
- Câu hỏi 1 bên dưới: có cần chọn giọng cho từng vai trong từng kịch bản không.

### K6c. Nghe cả bài

- Nút "Nghe cả bài" trên đầu trang Hội thoại: đọc lần lượt từ dòng đang chọn (mặc định dòng đầu) đến hết. Dòng đang
  đọc sáng karaoke như hôm nay và tự cuộn vào giữa màn hình.
- Trong lúc phát: Tạm dừng, Tiếp tục, Dừng. Phím tắt: Space tạm dừng hoặc tiếp tục, Esc dừng. Bấm loa của một dòng
  khác thì nhảy tới dòng đó.
- Tải trước hai dòng kế tiếp để không có khoảng lặng chờ VOICEVOX.
- Tốc độ đọc theo Cài đặt (`speechRate`) như hôm nay.
- Câu hỏi 2 bên dưới: khi bật "Che câu của tôi" thì dòng của người học được xử lý thế nào.

### Thứ tự PR

| PR  | Nội dung                                                     | Rủi ro | Kiểm                      |
| --- | ------------------------------------------------------------ | ------ | ------------------------- |
| K6a | Cache WAV trên server, giới hạn dung lượng, test logic thuần | medium | test + đo lần gọi thứ hai |
| K6b | Giọng theo người nói (logic thuần + nối vào trang)           | medium | test + ảnh 1440 và 390    |
| K6c | Nút "Nghe cả bài", tạm dừng, cuộn theo, tải trước            | medium | e2e + ảnh trước và sau    |

Mỗi PR đổi UI thì có trang duyệt ảnh trước và sau ở 1440 và 390, như bước 6, và thien duyệt rồi mới merge.

## Câu hỏi cho thien

1. **Chọn giọng cho từng vai?** Đề xuất: chưa cần. Giọng tự gán theo thứ tự là đủ để phân biệt A và B, và không
   cần đổi schema. Nếu anh muốn chọn (ví dụ B là nam trầm), em thêm một cột `voices` vào bảng `Script`
   (migration chỉ cộng thêm) và một ô chọn giọng cạnh tên vai.
2. **Khi "Che câu của tôi" đang bật, nghe cả bài làm gì ở dòng của anh?** Đề xuất: dừng một khoảng bằng độ dài câu
   đó để anh tự nói (shadowing), rồi đọc câu mẫu, rồi đi tiếp. Cách khác: đọc luôn như dòng thường, hoặc bỏ qua.
3. **Karaoke chính xác theo âm tiết?** Hôm nay chữ sáng đều theo thời gian. VOICEVOX trả được độ dài từng âm tiết,
   nên có thể làm chữ sáng đúng lúc được đọc, nhưng phải đổi `/api/tts` trả thêm thời gian và ghép với furigana.
   Đề xuất: để sau K6c, làm thành một PR riêng nếu anh thấy cách sáng đều hôm nay còn lệch nhiều.

## Giữ luật của sakubun

- Web không tự soạn câu, không tự chấm: đọc câu là công cụ cố định.
- Không đụng bảng học; không có migration nếu câu 1 giữ đề xuất.
- Logic thuần (khoá cache, chọn file xoá, gán giọng, thứ tự phát) tách khỏi I/O.

## Rủi ro

| Rủi ro                                         | Cách chặn                                                    |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Cache làm đầy đĩa NUC                          | Giới hạn 300 MB, xoá file lâu không dùng; test chọn file xoá |
| Hai lần gọi cùng câu ghi cùng một file một lúc | Ghi file tạm rồi đổi tên (thao tác nguyên tử)                |
| VOICEVOX chậm làm nghe cả bài bị ngắt          | Tải trước hai dòng; hiện trạng thái đang tải ở dòng kế tiếp  |
| Trình duyệt chặn tự phát âm thanh              | Chỉ bắt đầu sau khi người học bấm "Nghe cả bài"              |
