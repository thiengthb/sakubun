# Ứng cử viên tính năng cho Sakubun (bản nháp vòng 2)

Ngày: 2026-11-04. Trạng thái: **bản nháp, chưa duyệt**. Vòng 2 đã tính 8 câu trả lời của thien (mục 1).

Cơ sở: nghiên cứu ở `docs/plans/2026-11-04-research/` (A: SLA, B: trí nhớ, C: thói quen, D: đa giác quan, E: đối thủ,
F: Việt–Nhật, G: nguồn dữ liệu, H: phản biện Sakubun). Ký hiệu như "B8" trỏ tới mục trong các file đó.

## 1. Người học: thien trả lời (2026-11-04)

| Câu | Trả lời | Hệ quả cho danh sách |
|---|---|---|
| Trình độ, mục tiêu | N3 (7/2026): 117/180; kiến thức ngôn ngữ 48/60, đọc 34/60, nghe 35/60. Học N3 thật sự khoảng 1 tháng. Đang ôn cấp tốc **N2 tháng 12/2026**. Mục tiêu: hiểu tiếng Nhật và đam mê ngôn ngữ; đi làm; xem phim, anime; **mục tiêu cuối cùng là giao tiếp** | Đọc, nghe và nói lên trước. Cần một đường N2 cấp tốc riêng vì tính năng mới không kịp cho kỳ thi |
| Thói quen | Không ổn định, lúc thích lúc chán; học nhanh, rất mạnh Hán Việt, **dễ nên sinh lười**, lên cấp cao thì chững; lo rớt N2 | Thói quen và "khó khăn có ích" (B6) lên trước; Hán Việt cơ bản không cần cho thien nhưng vẫn cần cho người dùng khác |
| Phần có ích nhất | **Luyện dịch**, nhưng "chưa ổn, chưa hoàn thiện"; phần khác chưa dùng đủ sâu | Vòng dịch là lõi, phải sửa trước. Cần thien nói cụ thể chỗ chưa ổn (mục 6) |
| App khác | **Anki và Quizlet** cho từ, ngữ pháp, kanji; ít dùng app nghe, đọc; gần đây bỏ Anki vì lười và bận đồ án | Nhập dữ liệu từ Anki và Quizlet; chế độ trở lại sau khi nghỉ là bắt buộc |
| Thích | **Đa giác quan**, và **AI tự nghĩ nội dung dựa trên bài tập dịch** | Biến câu đã dịch thành bài nghe, bài nói, bài đọc |
| Kỹ năng yếu nhất | **Nghe và nói** | S1, S2, S3, S5, S6 lên đầu |
| Người dùng | **Nhiều người Việt**, có thể thu phí | Ghi nguồn đúng giấy phép là bắt buộc; không dùng dữ liệu NC; cần onboarding; Hán Việt là lợi thế cho người khác |
| AI trên web | **Không**. Chỉ đưa AI vào web khi có chiến lược kinh doanh và thu phí | Giữ nguyên "AI qua MCP". Mọi tính năng cần AI đi qua claude.ai; web chỉ lưu, kiểm, phát, chấm bằng luật |
| Bắt buộc giữ | Không có gì bắt buộc | Được phép đập đi xây lại. Mình vẫn đề nghị giữ lịch FSRS và lịch sử ôn vì chúng rẻ để giữ và là dữ liệu cho R1 |

**Một mâu thuẫn cần nói thẳng**: người dùng là nhiều người Việt, nhưng phần hay nhất (dịch với AI) đòi người học có tài
khoản Claude hoặc ChatGPT và biết thêm connector MCP. Với người ngoài, đó là rào cản lớn. Quyết định "chưa đưa AI vào web"
là hợp lý lúc này, nhưng nghĩa là trong giai đoạn đầu, phần web không có AI phải đủ tốt để tự đứng được.

## 2. Kết luận chính

1. Sakubun dạy **từng mục** rất kỹ nhưng thiếu **nghe, đọc khối lượng lớn** và **luyện nói, trôi chảy** (A1, H1). Đây
   cũng đúng là hai kỹ năng thien yếu nhất.
2. **Thói quen** là phần yếu nhất so với bằng chứng (C1, B8), và đúng với thien: học theo hứng, bỏ Anki khi bận.
3. Lợi thế khó sao chép nhất: **vòng dịch với AI** (câu mới mỗi lần) và **ngách Việt–Nhật** (F2, D3). Cách nối hai
   lợi thế với sở thích của thien: **câu mình đã dịch thành bài nghe, nói, đọc** (S6, I2).

## 3. Cách chấm điểm

Mỗi trục từ 1 đến 5, **5 luôn là tốt**: **Tác động** (giúp học và giữ thói quen); **Bằng chứng** (5 = nhiều
meta-analysis, 1 = kinh nghiệm sản phẩm); **Khớp** (với thien và người dùng Việt, theo câu trả lời ở mục 1); **Nhẹ**
(5 = vài ngày công); **An toàn** (5 = không đụng schema, dữ liệu học hay chi phí).

## 4. Danh sách ứng cử viên

### Hướng 0. Nền móng

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| N1 | Trang "Nguồn dữ liệu và giấy phép" + dòng ghi nguồn VOICEVOX ở trình phát | 1 | bắt buộc pháp lý | 5 | 5 | 5 |
| M1 | **Nhập từ Anki và Quizlet** (file xuất của Quizlet, gói `.apkg` của Anki), giữ lịch sử nếu có | 3 | 1 | 5 | 3 | 4 |

### Hướng 1. Vòng học hằng ngày và thói quen

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| T1 | **Chế độ trở lại**: sau khi nghỉ, tạm dừng mục mới, chia nợ ôn ra vài ngày, ưu tiên mục sắp quên nhất | 5 | 3 | 5 | 4 | 4 |
| T2 | **Chuỗi ngày có ân hạn** (bỏ 1 ngày không mất chuỗi) + **phiên tối thiểu** (5 thẻ hoặc 1 câu vẫn tính) | 4 | 3 | 5 | 5 | 5 |
| T3 | **Nhắc học theo ý định**: người học chọn "khi nào, sau việc gì", app nhắc đúng lúc (Web Push) | 4 | 5 | 5 | 3 | 4 |
| T4 | **Màn "Hôm nay"**: một nút bắt đầu, app trộn ôn, mục mới và một bài nghe ngắn, ước lượng số phút | 4 | 2 | 4 | 3 | 4 |

- **T1**: tài khoản thien có 84 thẻ đến hạn; thien cũng bỏ Anki vì cùng lý do. Phản biện: hoãn thẻ làm vài thẻ quên thật.
  Quên vài thẻ rẻ hơn bỏ app. Đo: tỷ lệ quay lại học sau khi nghỉ 3 ngày trở lên.
- **T2**, **T3**: người học theo hứng cần cơ chế nhẹ, không gây tội lỗi (C3, C4). Tắt được.

### Hướng 2. Vòng dịch và ôn tập

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| R6 | **Bước thử lại** khi dịch với AI: AI chỉ ra vùng lỗi, người học sửa một lần rồi mới xem câu mẫu | 4 | 4 | 5 | 5 | 5 |
| R7 | **Sửa những chỗ "chưa ổn" của vòng dịch** (chờ thien liệt kê, mục 6) | ? | ? | 5 | ? | ? |
| R3 | **Đối chiếu mẫu dễ nhầm** (は/が, そうだ/ようだ/らしい, たら/ば/と/なら, các mẫu N2 gần nghĩa) | 4 | 4 | 5 | 3 | 4 |
| R2 | **Gõ hoặc nói đáp án** trong Ôn nhanh (gõ romaji tự thành kana) | 4 | 5 | 4 | 3 | 4 |
| R1 | **Tối ưu tham số FSRS theo từng người**; cho thấy đánh đổi mức nhớ và khối lượng ôn | 3 | 5 | 3 | 4 | 4 |
| R5 | **Mục đỉa đổi cách học**: thêm câu, mục dễ nhầm, Hán Việt thay vì chỉ tạm dừng | 3 | 3 | 3 | 4 | 5 |
| R4 | **Tách lịch theo chiều** hoặc theo mức "nhận ra" và "dùng được" | 4 | 4 | 3 | 2 | 2 |

- **R3** có ích ngay cho N2 (phần ngữ pháp N2 nhiều mẫu gần nghĩa). Bản đầu làm được chỉ bằng prompt MCP, không code.
- **R4** đổi schema lớn, cần decision record. Phản biện: tăng số thẻ, đi ngược T1.

### Hướng 3. Nghe và nói (lên đầu vì là kỹ năng yếu nhất)

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| S6 | **Nghe lại và nói lại câu mình đã dịch**: mỗi câu đã chấm (bảng `Turn`) thành bài nghe VOICEVOX, có chế độ **nghe chép chính tả** và **nói đuổi** | 5 | 4 | 5 | 4 | 5 |
| S1 | **Luyện tai** 2–3 phút: cặp tối thiểu về trường độ nguyên âm, phụ âm kép, nhiều giọng VOICEVOX | 4 | 5 | 5 | 4 | 5 |
| S2 | **Shadowing có ghi âm** trong Kaiwa: phát từng câu, người học nói đuổi, nghe lại so với bản mẫu | 4 | 3 | 5 | 3 | 4 |
| S3 | **Karaoke và nghe ba lượt** (không chữ, có chữ, không chữ) trong Kaiwa | 3 | 4 | 5 | 3 | 5 |
| S5 | **Nhiệm vụ Kaiwa có mục tiêu**: AI (qua claude.ai, có giọng nói) đóng vai, người học phải đạt mục tiêu, AI chấm theo mục tiêu | 5 | 4 | 5 | 3 | 4 |
| S4 | **Đường cao độ** trên từ (dữ liệu Kanjium) | 2 | 3 | 2 | 3 | 4 |

- **S6** là ứng cử viên mới của vòng 2, nối đúng ba điều thien nói: thích luyện dịch, thích đa giác quan, yếu nghe và
  nói. Không cần AI trên web: câu tiếng Nhật đã có trong `Turn`, giọng đọc đã có (K6). Chép chính tả chấm bằng so chuỗi
  (sau khi chuẩn hoá kana), đúng luật "web không tự chấm tự do". Phản biện: câu tự dịch là câu ngắn, giọng máy, không
  giống bài nghe N2 thật. Đúng, nên S6 là bài khởi động, bài nghe thật vẫn cần I2.
- **S5** làm qua claude.ai (giọng nói của app Claude) vì không có AI trên web. Hiện đã có "Nhập vai với AI" (K8); việc
  cần làm là thêm mục tiêu và tiêu chí chấm vào kịch bản.

### Hướng 4. Đầu vào phân cấp (đọc, nghe nhiều)

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| I2 | **Bài đọc và nghe theo kho**: AI (qua MCP) soạn bài ngắn từ mục và câu người học đã dịch, server kiểm 95–98% từ đã biết, lưu như kịch bản có âm thanh | 5 | 4 | 5 | 3 | 4 |
| I1 | **Trình đọc**: dán văn bản tiếng Nhật, app tô từ đã thuộc / đang học / mới, rê để xem nghĩa, một chạm thêm vào kho **kèm câu gốc** | 5 | 4 | 4 | 3 | 4 |
| I3 | **Furigana tự ẩn** với chữ người học đã thuộc | 3 | 2 | 3 | 4 | 5 |

- **I2** là "AI tự nghĩ nội dung dựa trên bài tập dịch" mà thien thích, giữ luật AI qua MCP: AI soạn, server kiểm và từ
  chối nếu quá khó.

### Hướng 5. Lợi thế Việt–Nhật (cho người dùng Việt nói chung)

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| V3 | **Giải thích ngữ pháp đối chiếu tiếng Việt** trong thẻ giải thích | 4 | 2 | 4 | 4 | 5 |
| V1 | **Hán Việt thông minh**: bẫy bạn giả, quy luật âm Hán Việt sang On, gom từ theo chữ Hán chung | 4 | 2 | 4 | 3 | 5 |
| V4 | **Mở rộng từ điển Việt**: AI dịch nghĩa JMdict cho 10–20 nghìn từ thông dụng, người học báo lỗi, công bố lại CC BY-SA | 4 | 1 | 4 | 2 | 4 |
| V2 | **Chữ Hán là một loại mục** có lịch riêng, học qua Hán Việt | 3 | 3 | 3 | 2 | 2 |

### Hướng 6. Thấy mình tiến bộ và thi

| Mã | Tính năng | Tác động | Bằng chứng | Khớp | Nhẹ | An toàn |
|---|---|---|---|---|---|---|
| P1 | **Phân tích theo năng lực**: phần trăm mục từng cấp JLPT đã vững, lỗi nào giảm theo tháng, nút luyện ngay | 4 | 3 | 4 | 3 | 5 |
| P3 | **Luyện theo định dạng JLPT** (đọc hiểu, nghe hiểu theo dạng đề), AI soạn qua MCP | 3 | 2 | 5 | 3 | 4 |
| P2 | **Kiểm tra xếp lớp** lúc bắt đầu, gợi ý lấy bộ nào từ Kho chung | 3 | 2 | 4 | 3 | 5 |

## 5. Thứ tự đề xuất

**Đường A. N2 cấp tốc (từ nay đến kỳ thi đầu tháng 12, gần như không code).** Tính năng mới mất vài tuần sẽ không kịp
giúp. Đề xuất một **kế hoạch học 4 tuần riêng** dùng thứ đã có: luyện dịch với mục N2 trong claude.ai; AI soạn bài đọc
và bài nghe dạng N2 (bằng prompt, chưa cần code); đề mẫu chính thức trên jlpt.jp; R3 bằng prompt. Code nhỏ nhất đáng
làm trong đường này: **S6** (vài ngày, giúp nghe ngay).

**Đợt 1 (sau hoặc song song với kỳ thi): sửa lõi và thói quen.** N1, R7, R6, T1, T2, S6, S1, M1.

**Đợt 2: nghe, nói, đọc trên web.** S2, S3, I1, R3 (bản có code), R2, T3, P1.

**Đợt 3: lớn hơn, cho nhiều người dùng.** I2, S5, T4, P2, P3, V3, V1, V4, R1.

**Để sau hoặc bỏ**: R4, V2, S4 (cao độ), luyện viết tay, hình ảnh cho từ, thêm cơ chế cộng đồng cho Kho chung (thích,
xếp hạng) trước khi có người dùng.

## 6. Còn cần thien trả lời

1. **Vòng dịch "chưa ổn" ở đâu?** Kể 2–3 lần cụ thể bạn thấy khó chịu (AI chấm sai, câu quá dễ hay quá khó, phải gõ
   nhiều, chuyển qua lại claude.ai mệt, phản hồi dài...). Đây là R7, việc quan trọng nhất của đợt 1.
2. Có muốn kế hoạch **N2 cấp tốc 4 tuần** (đường A) không?
3. Học viết tay kanji: cần hay không? (Mình mặc định là không, vì JLPT không thi viết.)

## 7. Cách biết một tính năng có hiệu quả

Mỗi tính năng khi làm ghi trước **một con số** để so trước và sau (số ngày học trong 30 ngày, tỷ lệ nhớ thật, số lỗi
cùng loại mỗi 100 câu, điểm chép chính tả). Dữ liệu đã có trong `ReviewLog` và `Turn`. Ít người dùng thì không làm
A/B test được; so trước và sau trên chính thien là đủ để quyết định giữ hay bỏ.

## 8. Bước tiếp theo

1. thien trả lời mục 6 và phản biện bản này.
2. thien duyệt danh sách cuối; mỗi đợt có kế hoạch riêng trong `docs/plans/` như các phase trước.
3. Rồi mới sang quy trình 2 (luật làm việc) và quy trình 3 (UI/UX và style).
