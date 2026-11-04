# Ứng cử viên tính năng cho Sakubun (bản nháp vòng 1)

Ngày: 2026-11-04. Trạng thái: **bản nháp, chưa duyệt**. Chờ thien trả lời 8 câu hỏi trong
`docs/plans/2026-11-04-research/00-ke-hoach.md` (mục 5), rồi chỉnh lại điểm "khớp nhu cầu" và thứ tự.

Cơ sở: nghiên cứu ở `docs/plans/2026-11-04-research/` (A: SLA, B: trí nhớ, C: thói quen, D: đa giác quan, E: đối thủ,
F: Việt–Nhật, G: nguồn dữ liệu, H: phản biện Sakubun). Ký hiệu như "B8" trỏ tới mục trong các file đó.

## 1. Kết luận chính trong ba câu

1. Sakubun dạy **từng mục** rất kỹ (FSRS, AI soạn câu mới, Hán Việt), nhưng thiếu **đầu vào khối lượng lớn** (nghe,
   đọc) và **luyện trôi chảy**, hai trong bốn nhánh của một chương trình học cân bằng (A1, H1).
2. Phần yếu nhất so với bằng chứng là **thói quen**: không có nhắc học, không có ân hạn, không có lối thoát khi thẻ dồn
   lại (C1, B8). Tài khoản của thien đang có 84 thẻ đến hạn và chuỗi ngày 0.
3. Lợi thế khó sao chép nhất là **ngách Việt–Nhật**: Hán Việt, giải thích đối chiếu tiếng Việt, luyện tai cho đúng chỗ
   người Việt yếu (F2, D3).

## 2. Cách chấm điểm

Mỗi trục từ 1 đến 5, **5 luôn là tốt**:

- **Tác động**: giúp học và giữ thói quen nhiều đến đâu.
- **Bằng chứng**: 5 = nhiều meta-analysis; 3 = vài nghiên cứu tốt; 1 = kinh nghiệm sản phẩm.
- **Khớp**: khớp nhu cầu của thien. Hiện là **mình đoán**, đánh dấu `?`, sửa sau khi thien trả lời.
- **Nhẹ**: 5 = vài ngày công, 1 = nhiều tuần hoặc đổi kiến trúc.
- **An toàn**: 5 = không đụng schema, dữ liệu học hay chi phí; 1 = đổi schema lớn hoặc tốn tiền định kỳ.

## 3. Danh sách ứng cử viên

### Hướng 0. Nền móng

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| N1 | Trang "Nguồn dữ liệu và giấy phép" + dòng ghi nguồn VOICEVOX ở trình phát | 1 | không áp dụng (bắt buộc pháp lý) | 3? | 5 | 5 |

### Hướng 1. Vòng học hằng ngày và thói quen

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| T1 | **Chế độ trở lại**: sau khi nghỉ, tạm dừng mục mới, chia nợ ôn ra vài ngày, ưu tiên mục sắp quên nhất | 5 | 3 | 5? | 4 | 4 |
| T2 | **Chuỗi ngày có ân hạn** (bỏ 1 ngày không mất chuỗi) + **phiên tối thiểu** (5 thẻ hoặc 1 câu vẫn tính) | 4 | 3 | 4? | 5 | 5 |
| T3 | **Nhắc học theo ý định**: người học chọn "khi nào, sau việc gì", app nhắc đúng lúc (Web Push, hoặc kênh thien chọn) | 4 | 5 | ? | 3 | 4 |
| T4 | **Màn "Hôm nay"**: một nút bắt đầu, app tự trộn ôn, mục mới và một bài nghe hoặc đọc ngắn, ước lượng số phút | 4 | 2 | 4? | 3 | 4 |

- **T1** vấn đề: mở app thấy hàng trăm thẻ thì bỏ (B8). Cách làm: logic thuần trong `lib/domain/queue.ts`, dùng xác
  suất nhớ hiện tại của FSRS. Phản biện: hoãn thẻ làm một số thẻ quên thật. Trả lời: quên vài thẻ rẻ hơn bỏ app. Đo: tỷ
  lệ quay lại học sau khi nghỉ 3 ngày trở lên.
- **T2** phản biện: ân hạn có thể làm người học lười. Bằng chứng của Lally và số liệu đóng băng chuỗi của Duolingo đều
  nói ân hạn không làm nghỉ nhiều hơn (C1, C3).
- **T3** phản biện: thông báo dễ thành phiền. Trả lời: chỉ nhắc đúng một lần vào giờ người học chọn, tắt được.

### Hướng 2. Ôn tập sâu hơn

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| R1 | **Tối ưu tham số FSRS theo từng người** khi đủ lượt ôn; cho thấy đánh đổi mức nhớ và khối lượng ôn | 3 | 5 | 3? | 4 | 4 |
| R2 | **Gõ hoặc nói đáp án** trong Ôn nhanh (gõ romaji tự thành kana) | 4 | 5 | ? | 3 | 4 |
| R3 | **Đối chiếu mẫu dễ nhầm** (は/が, そうだ/ようだ/らしい, たら/ば/と/なら) | 4 | 4 | 4? | 3 | 4 |
| R4 | **Tách lịch theo chiều** (Nhật sang Việt và Việt sang Nhật) hoặc theo mức "nhận ra" và "dùng được" | 4 | 4 | ? | 2 | 2 |
| R5 | **Mục đỉa đổi cách học**: thêm câu, Hán Việt, mục dễ nhầm thay vì chỉ tạm dừng | 3 | 3 | 3? | 4 | 5 |
| R6 | **Bước thử lại** trong vòng dịch với AI: chỉ ra vùng lỗi, người học sửa một lần rồi mới xem câu mẫu | 4 | 4 | ? | 5 | 5 |

- **R4** là thay đổi schema và hành vi học lớn: cần decision record và thien duyệt. Phản biện: tăng gấp đôi số thẻ, tăng
  nợ ôn, đi ngược T1. Có thể thử bản nhẹ: chỉ tách cho từ vựng.
- **R6** chỉ sửa prompt `hoc` và kết quả `grade_turn`. Phản biện: thêm một bước làm phiên dài hơn. Đo: lỗi cùng loại có
  giảm ở lần gặp sau không (errorTags).

### Hướng 3. Đầu vào phân cấp (nghe, đọc nhiều)

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| I1 | **Trình đọc**: dán văn bản tiếng Nhật bất kỳ, app tách từ, tô màu từ đã thuộc / đang học / mới, rê để xem nghĩa, một chạm thêm vào kho **kèm câu gốc** | 5 | 4 | ? | 3 | 4 |
| I2 | **Bài đọc và nghe theo kho**: AI (qua MCP) soạn bài ngắn, server kiểm 95–98% từ đã biết, lưu như kịch bản Kaiwa có âm thanh | 5 | 4 | ? | 3 | 4 |
| I3 | **Furigana tự ẩn** với chữ người học đã thuộc | 3 | 2 | 3? | 4 | 5 |

- **I1** dùng lại hầu hết phần có sẵn của Kaiwa (kuromoji, tra nghĩa, "Thêm vào kho"). Phản biện: người sơ cấp dán văn
  bản thật sẽ ngợp. Trả lời: I2 cho người sơ cấp, I1 cho người trung cấp trở lên.
- **I2** giữ nguyên tắc "web không tự gọi AI": AI của người học soạn, server kiểm độ phủ và từ chối nếu quá khó (luật
  ép bằng code, đúng CLAUDE.md).

### Hướng 4. Nghe và nói

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| S1 | **Luyện tai** 2–3 phút: cặp tối thiểu về trường độ nguyên âm, phụ âm kép (おばさん/おばあさん, きて/きって), nhiều giọng VOICEVOX | 4 | 5 | ? | 4 | 5 |
| S2 | **Shadowing có ghi âm** trong Kaiwa: phát từng câu, người học nói đuổi, nghe lại so với bản mẫu | 4 | 3 | ? | 3 | 4 |
| S3 | **Karaoke và nghe ba lượt** (không chữ, có chữ, không chữ) trong Kaiwa | 3 | 4 | 3? | 3 | 5 |
| S4 | **Đường cao độ** trên từ (dữ liệu Kanjium) | 2 | 3 | ? | 3 | 4 |
| S5 | **Nhiệm vụ Kaiwa có mục tiêu**: AI đóng vai, người học phải đạt mục tiêu, AI chấm theo mục tiêu | 5 | 4 | ? | 2 | 3 |

- **S1** gần như không app Việt nào làm, rẻ vì đã có VOICEVOX và bộ cache âm thanh (K6). Phản biện: nghe tốt hơn chưa
  chắc nói tốt hơn (D3). Đúng, nên ghép với S2.
- **S5** phụ thuộc quyết định AI trong web (Q1): qua claude.ai thì làm được nhưng nhiều bước.

### Hướng 5. Lợi thế Việt–Nhật

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| V1 | **Hán Việt thông minh**: đánh dấu bạn giả (大家, 勉強, 迷惑), gợi ý quy luật âm Hán Việt sang On, gom từ theo chữ Hán chung | 4 | 2 | 4? | 3 | 5 |
| V2 | **Chữ Hán là một loại mục** có lịch riêng, học qua Hán Việt và từ đã biết | 4 | 3 | ? | 2 | 2 |
| V3 | **Giải thích ngữ pháp đối chiếu tiếng Việt** trong thẻ giải thích (〜ている và "đang", "đã... rồi") | 4 | 2 | 4? | 4 | 5 |
| V4 | **Mở rộng từ điển Việt**: AI dịch nghĩa JMdict cho 10–20 nghìn từ thông dụng, người học báo lỗi, công bố lại CC BY-SA | 4 | 1 | 3? | 2 | 4 |

- **V1** phản biện: nghiên cứu nói người sơ cấp không nên dựa quá nhiều vào Hán Việt (F2). Trả lời: hiện sau khi người
  học đã thử nhớ, không hiện trước.
- **V3** làm qua AI (enrichment), không cần code lớn; cần một mẫu giải thích chuẩn.

### Hướng 6. Thấy mình tiến bộ

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| P1 | **Phân tích theo năng lực**: phần trăm từ và ngữ pháp từng cấp JLPT đã vững, lỗi nào giảm theo tháng, nút luyện ngay cạnh mỗi điểm yếu | 4 | 3 | 4? | 3 | 5 |
| P2 | **Kiểm tra xếp lớp** lúc bắt đầu: vài phút, gợi ý lấy bộ nào từ Kho chung | 3 | 2 | ? | 3 | 5 |
| P3 | **Luyện đề JLPT** theo định dạng thật | 3 | 2 | ? | 2 | 4 |

## 4. Quyết định chiến lược (thien chọn, ảnh hưởng nhiều ứng cử viên)

- **Q1. AI trong web?** Giữ "AI chỉ qua MCP" (rẻ, đúng kiến trúc hiện tại, nhưng nhiều bước) hay thêm đường gọi AI ngay
  trên web (dễ dùng, tốn API, phải xử lý chi phí và lạm dụng). Có thể làm lai: người học tự gắn khoá API của mình.
- **Q2. Ai là người dùng?** Chỉ thien và bạn bè (ưu tiên vòng học, bỏ cơ chế cộng đồng) hay cộng đồng người Việt (cần
  P2, onboarding, Kho chung có nội dung).
- **Q3. Có học viết tay không?** Ảnh hưởng KanjiVG và V2.
- **Q4. Mục tiêu JLPT?** Ảnh hưởng P3 và thứ tự mục.

## 5. Thứ tự đề xuất (chưa tính câu trả lời của thien)

**Đợt 1: rẻ, bằng chứng tốt, sửa đúng chỗ đau.** N1, T1, T2, R6, R1, S1.
Lý do: T1 và T2 nhắm đúng lý do bỏ học; R6 chỉ đổi prompt; R1 có bằng chứng mạnh nhất; S1 rẻ và chỉ người Việt cần.

**Đợt 2: thêm đầu vào và đầu ra trên web.** I1, R2, R3, S2, S3, P1, V3.

**Đợt 3: lớn, cần quyết định chiến lược trước.** I2, S5, T3, T4, V1, V2, V4, R4.

**Để sau hoặc bỏ**: S4 (cao độ), P2, P3, hình ảnh cho từ, luyện viết tay, thêm cơ chế cộng đồng cho Kho chung (thích,
xếp hạng) trước khi có người dùng.

## 6. Cách biết một tính năng có hiệu quả

Mỗi tính năng khi làm sẽ ghi trước **một con số** để so trước và sau (ví dụ: số ngày học trong 30 ngày, tỷ lệ nhớ thật,
số lỗi は/が mỗi 100 câu). Dữ liệu đã có trong `ReviewLog` và `Turn`. Với vài chục người dùng thì không làm A/B test
được; so trước và sau trên chính thien là đủ để quyết định giữ hay bỏ.

## 7. Bước tiếp theo

1. thien trả lời 8 câu hỏi và phản biện bản này (đồng ý, không đồng ý, thiếu gì).
2. Mình sửa điểm "khớp", thứ tự, và bỏ hoặc thêm ứng cử viên.
3. thien duyệt danh sách cuối. Mỗi đợt sau đó có kế hoạch riêng trong `docs/plans/` như các phase trước.
4. Rồi mới sang quy trình 2 (luật làm việc) và quy trình 3 (UI/UX và style).
