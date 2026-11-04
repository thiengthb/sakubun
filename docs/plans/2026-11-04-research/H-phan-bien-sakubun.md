# H. Phản biện Sakubun hiện tại (2026-11-04)

Đối chiếu từng phần của app với kết luận ở A–G. Mỗi phần có: **giữ** (đúng, có bằng chứng), **sửa** (đúng hướng,
thiếu sót), **xem lại** (có thể sai hướng, cân nhắc đập đi xây lại). Đây là ý kiến của mình, cần thien phản biện,
nhất là chỗ mình đoán thói quen dùng của bạn.

## H1. Toàn cảnh

Sakubun hôm nay: kho mục riêng (ngữ pháp, từ vựng) có lịch FSRS; vòng **dịch câu với AI** qua MCP (AI soạn câu theo
mục đến hạn, người học dịch, AI chấm 1–4); **Ôn nhanh** trên web (thẻ lật và chọn đáp án, câu ví dụ có dịch); **Nhóm**;
**Kho chung**; **Hội thoại** (Kaiwa: kịch bản, nghe, che câu, rê chuột xem nghĩa, nhập vai qua claude.ai, chia sẻ);
**Lịch sử**; **Phân tích**; **Cài đặt**.

Theo bốn nhánh của Nation (A1): nhánh 3 (học tập trung vào ngôn ngữ) rất mạnh; nhánh 2 (đầu ra) mạnh nhưng chỉ ở
claude.ai; nhánh 1 (đầu vào: nghe, đọc nhiều) và nhánh 4 (trôi chảy) gần như không có. **Đây là phát hiện quan trọng
nhất**: app đang dạy rất kỹ từng mục, nhưng ít cho người học **dùng** chúng với khối lượng lớn.

## H2. Từng phần

### Lịch FSRS, `recordReviews()` là lối duy nhất

- **Giữ**: FSRS có bằng chứng mạnh nhất hiện nay (B3). Kiến trúc một lối ghi lịch là đúng.
- **Sửa**: (1) chưa tối ưu tham số theo từng người (B3, lợi ích được đo ở 84% người dùng); (2) một trạng thái cho cả hai
  chiều dịch (B7); (3) chưa có chế độ trở lại khi nợ ôn (B8).

### Vòng dịch câu với AI (lõi của Sakubun)

- **Giữ**: đầu ra có phản hồi (A3, A4); AI soạn câu mới mỗi lần nên không học thuộc câu (B4), đây là lợi thế thật so
  với Bunpro.
- **Sửa**: (1) chưa có bước "thử lại" trước khi xem câu mẫu (A4); (2) chỉ chạy trong claude.ai: người học phải chuyển
  qua lại, và người không dùng Claude thì không có phần hay nhất; (3) AI chấm 1–4 theo cảm nhận, có thể lệch giữa các
  phiên (chưa có số đo độ nhất quán); (4) mọi bài đều qua tiếng Việt (A7).
- **Xem lại**: nguyên tắc "web không gọi AI" (CLAUDE.md). Nguyên tắc này đúng khi Sakubun chỉ cho thien, nhưng nếu muốn
  nhiều người dùng thì nó chặn trải nghiệm chính. Đây là câu hỏi chiến lược cho thien.

### Ôn nhanh

- **Giữ**: câu ví dụ có dịch, thẻ giới thiệu cho mục mới, xoay vòng nhiều câu (C5), làm lại câu sai cuối buổi.
- **Sửa**: (1) chọn đáp án là nhận diện, nhẹ hơn tự nhớ (B2); thêm tuỳ chọn gõ đáp án (có chuyển romaji sang kana,
  F5) và nói đáp án; (2) ngữ pháp ở Ôn nhanh chỉ đo "nhận ra mẫu", nhưng ghi vào cùng lịch FSRS với "dùng được mẫu" ở
  vòng dịch câu. Hai việc này khác nhau (B4); cần quyết định có tách không; (3) chưa có bài đối chiếu mẫu dễ nhầm (B5).

### Mục trong kho (ngữ pháp, từ vựng)

- **Sửa**: thiếu loại **cụm từ / câu dùng ngay** (A6) và **chữ Hán** như một mục riêng (F2). Thiếu cao độ (D4), thiếu
  đánh dấu bạn giả Hán Việt (F2).

### Nhóm và Kho chung

- **Giữ**: kho mới trống, người học tự lấy về (tự chủ, C2); chia sẻ và tái bản kiểu Quizlet.
- **Xem lại**: với 50 tài khoản, Kho chung sẽ ít nội dung cộng đồng trong thời gian dài. Giá trị thật của nó lúc này là
  bộ OpenJLPT có tiếng Việt. Không nên đầu tư thêm cơ chế cộng đồng (thích, xếp hạng) trước khi có người dùng.

### Hội thoại (Kaiwa)

- **Giữ**: kịch bản có tách từ, furigana, nghĩa khi rê chuột, giọng theo vai, che câu của mình: rất hợp cho shadowing
  và đầu vào có trình tự.
- **Sửa**: (1) thêm chế độ **shadowing có ghi âm** (D5); (2) karaoke chữ theo tiếng (D2, đã hoãn ở K6); (3) nghe không
  chữ rồi có chữ (D2).
- **Xem lại**: Kaiwa đang là "kịch bản để đọc". Theo A8, giá trị lớn hơn là **nhiệm vụ để hoàn thành** (nhập vai có mục
  tiêu, AI chấm theo mục tiêu). Nhập vai hiện cần dán câu vào claude.ai: nhiều bước, dễ bỏ.

### Phân tích

- **Giữ**: đã có báo cáo lỗi theo thẻ lỗi, mục đỉa (leech), tỷ lệ nhớ thật so với mong muốn, dự báo 14 ngày.
- **Sửa**: số liệu hiện thiên về **thẻ** (bao nhiêu thẻ, bao nhiêu đến hạn). Người học cần số liệu về **năng lực**
  (C2): đã biết bao nhiêu phần trăm từ N4, lỗi nào giảm theo thời gian, đọc được bao nhiêu phần trăm một bài. Thêm hành
  động ngay cạnh số liệu ("luyện 10 câu は/が").

### Thói quen

- Có chuỗi ngày, mục tiêu phiên, hạn mức ngày. **Chưa có**: nhắc học, ân hạn cho chuỗi ngày, phiên tối thiểu, chế độ
  trở lại (C1, B8). Đây là phần **thiếu nhiều nhất so với bằng chứng**, và khớp với tình trạng 84 thẻ đến hạn, chuỗi 0.

### Đầu vào (nghe, đọc nhiều)

- **Chưa có.** Không có bài đọc phân cấp, không có nghe hiểu có câu hỏi, không có tra từ trên văn bản bất kỳ người học
  dán vào. Đây là chỗ Sakubun có lợi thế (biết người học thuộc gì) mà chưa dùng (A2, E2).

### Giấy phép và ghi nguồn

- **Sửa ngay**: không thấy ghi nguồn VOICEVOX theo nhân vật, OpenJLPT, Tatoeba, JMdict trên giao diện (G2).

## H3. Ba điều mình nghĩ là sai lầm (cần thien phản biện)

1. **Đầu tư nhiều vào cơ chế (Kho chung, chia sẻ, quản trị) trước khi vòng học hằng ngày đủ hấp dẫn để chính thien
   dùng mỗi ngày.** Dấu hiệu: chuỗi ngày 0 và 84 thẻ đến hạn. Nếu người xây app không dùng hằng ngày thì người khác càng
   không.
2. **Phần hay nhất (AI soạn và chấm) nằm ngoài app.** Người học mở Sakubun trên điện thoại chỉ thấy Ôn nhanh, là phần
   giống Anki nhất.
3. **Thiếu đầu vào và trôi chảy.** Học rất kỹ từng mục nhưng ít cơ hội gặp và dùng chúng trong văn bản, lời nói thật.

## H4. Điều Sakubun đang làm tốt hơn đối thủ

1. Tiếng Việt là ngôn ngữ chính, có Hán Việt kiểm chéo ba nguồn.
2. AI soạn câu mới cho mỗi lượt ôn ngữ pháp.
3. FSRS và kiến trúc dữ liệu sạch (một lối ghi lịch, dữ liệu riêng từng người, luật là test).
4. Kaiwa có tách từ, furigana, giọng theo vai: nền tốt cho nghe và shadowing.
5. Người học giữ quyền với AI của mình (MCP), không bị khoá vào một nhà cung cấp.
