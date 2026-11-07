# Kế hoạch nghiên cứu: Sakubun nên có những tính năng gì

Ngày: 2026-11-04. Người yêu cầu: thien. Đây là **quy trình 1** trong ba quy trình thien đặt ra.

## 1. Câu hỏi lớn cần trả lời

1. Khoa học về học ngoại ngữ nói gì là thật sự hiệu quả, và mức độ chắc chắn của từng kết luận ra sao?
2. Các app, web, phần mềm đang làm tốt điều gì (và sai ở đâu) trong việc dạy, luyện và giữ thói quen?
3. Người Việt học tiếng Nhật có lợi thế và khó khăn riêng nào mà app viết cho người nói tiếng Anh bỏ qua?
4. Nguồn dữ liệu từ vựng, ngữ pháp, câu ví dụ, âm thanh nào đáng tin và **được phép dùng** (giấy phép)?
5. Sakubun hôm nay đúng ở đâu, thiếu ở đâu, sai ở đâu, cái gì nên giữ, sửa, hay đập đi xây lại?
6. Từ 1–5, nên làm tính năng nào, theo thứ tự nào?

## 2. Bảy mảng nghiên cứu

| Mảng | Nội dung | Nguồn chính | Đầu ra |
|---|---|---|---|
| A. Thụ đắc ngôn ngữ thứ hai (SLA) | Đầu vào hiểu được (Krashen), tương tác (Long), đầu ra và nhận ra lỗ hổng (Swain), chú ý (Schmidt), học từ ngẫu nhiên và có chủ đích (Nation), luyện tập có chủ đích và tự động hoá (DeKeyser), phản hồi sửa lỗi (Lyster, Li), 4 nhánh cân bằng của Nation | Bài tổng quan, meta-analysis, sách giáo trình SLA | Bảng nguyên lý, mức bằng chứng, hệ quả cho app |
| B. Trí nhớ và ôn tập | Lặp lại ngắt quãng, hiệu ứng kiểm tra (retrieval practice), xen kẽ (interleaving), khó khăn có ích, FSRS so với SM-2, nhớ từ trong ngữ cảnh hay rời | Cepeda, Roediger và Karpicke, Bjork, Kang, dữ liệu benchmark FSRS | Luật cho ôn tập và thẻ |
| C. Thói quen và động lực | Hình thành thói quen (Lally 2010), chuỗi ngày và nỗi sợ mất chuỗi, lý thuyết tự quyết (Deci và Ryan), mục tiêu nhỏ, dark pattern cần tránh | Nghiên cứu tâm lý, báo cáo của Duolingo, phản hồi người dùng | Cơ chế giữ thói quen không thao túng |
| D. Học đa giác quan | Mã hoá kép (Paivio), tải nhận thức (Sweller), shadowing, nghe và phát âm, cao độ trọng âm tiếng Nhật, viết tay kanji, hình ảnh | Nghiên cứu ngữ âm học, giáo học pháp tiếng Nhật | Đề xuất cho nghe, nói, nhìn, viết |
| E. Đối thủ và mô hình sản phẩm | Anki, Duolingo, WaniKani, Bunpro, Renshuu, Migaku, LingQ, Satori Reader, Busuu, Speak, Mazii, Migii, Dungmori, Riki, các app AI hội thoại | Trang sản phẩm, tài liệu, review người dùng, cộng đồng | Bảng so sánh, mẫu đáng học, lỗi cần tránh |
| F. Ngách Việt–Nhật | Hán Việt giúp nhớ kanji, phát âm (âm dài, âm ngắt, trường độ), ngữ pháp khác biệt (trợ từ, kính ngữ), nhu cầu thực tế (du học, kỹ sư, thực tập sinh, JLPT) | Nghiên cứu về người Việt học tiếng Nhật, cộng đồng | Tính năng chỉ người Việt mới cần |
| G. Nguồn dữ liệu | JMdict, KANJIDIC2, Tatoeba, OpenJLPT, KanjiVG, danh sách tần suất, từ điển Việt–Nhật mở, ngữ pháp JLPT, âm thanh và cao độ | Trang nguồn và file giấy phép | Bảng nguồn: phạm vi, chất lượng, giấy phép, cách dùng |

Ngoài ra là mảng **H. Phản biện Sakubun hiện tại**: đi từng tính năng (Sakubun dịch câu với AI, Ôn nhanh, Nhóm,
Kho chung, Kaiwa, Lịch sử, Phân tích, Cài đặt, MCP) và đối chiếu với kết luận của A–G.

## 3. Cách phản biện

- Mỗi kết luận ghi **mức bằng chứng**: mạnh (nhiều meta-analysis), vừa (vài nghiên cứu tốt), yếu (ý kiến chuyên
  gia, kinh nghiệm app). Không trình bày ý kiến như sự thật.
- Mỗi đề xuất tính năng có: vấn đề người học gặp, bằng chứng, cách làm, **lý lẽ phản đối mạnh nhất**, rủi ro,
  cách đo xem nó có hiệu quả không.
- Chấm điểm mỗi ứng cử viên trên 5 trục: tác động đến việc học, độ chắc của bằng chứng, độ khớp với nhu cầu của
  thien, công sức làm, rủi ro (dữ liệu, chi phí AI, độ phức tạp).
- Đối chiếu với lời thien kể về chính việc học của mình (mục 5). Nghiên cứu nói một đằng mà người dùng thật sống
  một nẻo thì ghi rõ chỗ lệch và đề xuất cách thử.

## 4. Đầu ra

1. `docs/plans/2026-11-04-research/` trong repo: một file mỗi mảng A–H, có nguồn trích dẫn.
2. `docs/plans/2026-11-04-feature-candidates.md`: danh sách ứng cử viên tính năng đã chấm điểm, gom thành vài
   hướng lớn, kèm thứ tự đề xuất. thien duyệt file này thì quy trình 1 xong.
3. Một bản tóm tắt dễ đọc gửi trong thread.
4. Tất cả lên một PR chỉ có tài liệu.

## 5. Câu hỏi cho thien (khách hàng)

1. **Trình độ và mục tiêu**: bạn đang ở mức nào (JLPT, hay tự đánh giá nghe, nói, đọc, viết)? Học để làm gì
   (thi JLPT mức nào và khi nào, đi làm, nói chuyện, đọc manga hay xem anime)?
2. **Một ngày học thật**: bạn học lúc nào, ở đâu, bằng điện thoại hay laptop, bao nhiêu phút? Hôm nay app báo
   84 thẻ đến hạn và chuỗi ngày 0: gần đây điều gì làm bạn không mở app?
3. **Thích và ghét**: phần nào của Sakubun bạn dùng nhiều nhất và thấy có ích nhất? Phần nào bạn thấy sai, phiền,
   hoặc làm xong rồi không bao giờ dùng?
4. **App khác**: bạn đã dùng app nào (Anki, Duolingo, Mazii, Migii, Bunpro, WaniKani, Renshuu, Dungmori...)? Mỗi
   cái bạn giữ lại điều gì hay, và bỏ vì sao?
5. **Kỹ năng yếu nhất**: nghe, nói, đọc, viết, hay kanji? Lúc nói chuyện thật thì bạn kẹt ở đâu?
6. **Người dùng**: Sakubun chủ yếu cho bạn, hay bạn muốn nhiều người Việt khác dùng (bạn bè, cộng đồng, có thu
   phí)? Câu này quyết định nhiều thứ về Kho chung và thói quen.
7. **AI**: hiện AI chỉ làm thầy qua claude.ai (MCP), web không tự gọi AI. Bạn có muốn web tự gọi AI (tốn tiền API,
   nhưng không phải chuyển qua claude.ai) không? Ngân sách mỗi tháng khoảng bao nhiêu?
8. **Đập đi xây lại**: có điều gì bắt buộc giữ (dữ liệu học, lịch FSRS, kịch bản Kaiwa) không? Ngoài đó thì cái gì
   cũng được xem lại?

## 6. Phác thảo hai quy trình sau (chưa làm cho đến khi quy trình 1 xong)

**Quy trình 2: luật làm việc lâu dài giữa thien và Claude.** Gom luật hiện có (CLAUDE.md, STATUS, nhãn rủi ro)
và luật mới: viết tiếng Việt tự nhiên, không mù mờ; mỗi đề xuất có phản biện; khi nào hỏi, khi nào tự làm; mẫu
đầu ra cho kế hoạch, PR, báo cáo; cách hai bên phản biện nhau; nhịp duyệt. Đầu ra: sửa `CLAUDE.md` và một file
`docs/working-agreement.md`, thien duyệt.

**Quy trình 3: mổ xẻ UI/UX và hệ thống style.** Kiểm từng trang theo heuristic của Nielsen, WCAG 2.2, luật của
`docs/ui-standard.md`; thử với người dùng thật (thien và 1–2 người khác) bằng nhiệm vụ cụ thể; nghiên cứu style
hợp với app học tiếng Nhật (kiểu chữ Nhật và Việt, màu, khoảng cách, chế độ tối); ra bộ token và component rồi
làm lại từng trang. Đầu ra: báo cáo kiểm tra, đề xuất style có ảnh, kế hoạch từng PR.
