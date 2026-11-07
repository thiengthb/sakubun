# B. Trí nhớ và ôn tập

## B1. Lặp lại ngắt quãng (spacing)

- Cepeda và cộng sự (2006) tổng hợp 317 thí nghiệm: học rải ra nhớ lâu hơn học dồn, và khoảng cách tối ưu tăng
  theo thời gian muốn nhớ. **Mạnh.**
- Kim và Webb (2022) làm meta-analysis riêng cho học ngoại ngữ: học rải ra tốt hơn học dồn, rõ nhất ở bài kiểm tra
  trễ. **Mạnh.**

Sakubun đã dùng FSRS, nên phần này **đã đúng**.

## B2. Hiệu ứng kiểm tra (retrieval practice)

Tự nhớ lại (trả lời trước khi xem đáp án) tốt hơn đọc lại. Meta-analysis của Adesope và cộng sự (2017), 118 bài báo:
hiệu quả trung bình g khoảng 0,6; so với đọc lại khoảng 0,5; có phản hồi sau khi trả lời thì tốt hơn. **Mạnh.**

Hệ quả: thẻ "xem rồi tự chấm" yếu hơn thẻ bắt **gõ hoặc nói ra** câu trả lời. Ôn nhanh hiện có thẻ lật và thẻ chọn
đáp án (cloze). Chọn đáp án là **nhận diện**, nhẹ hơn **tự sinh**. Nên có thêm tuỳ chọn gõ đáp án (gõ kana) và nói đáp
án.

## B3. FSRS so với SM-2

Benchmark mở của open-spaced-repetition trên khoảng 10.000 bộ thẻ Anki, khoảng 350 triệu lượt ôn: FSRS-6 dự đoán
tốt hơn SM-2 cho 99,6% người dùng; FSRS **tối ưu tham số theo từng người** tốt hơn tham số mặc định cho 84,3% người
dùng. **Mạnh** (lưu ý: SM-2 không được thiết kế để dự đoán xác suất nhớ, nên so sánh không hoàn toàn công bằng).

Hệ quả cho Sakubun:

1. **Tối ưu tham số FSRS theo từng người** khi có đủ lượt ôn (ts-fsrs có optimizer). Hiện Sakubun dùng tham số mặc
   định. Việc này rẻ và có bằng chứng tốt.
2. **Mức nhớ mong muốn** (desiredRetention, mặc định 0,9) quyết định khối lượng ôn. Hạ xuống 0,85 giảm số lượt ôn
   đáng kể. Nên cho người học thấy đánh đổi bằng con số ("0,85: khoảng X thẻ/ngày, nhớ 85%").

## B4. FSRS cho ngữ pháp: chỗ cần phản biện

FSRS được huấn luyện trên dữ liệu thẻ Anki, phần lớn là từ vựng: một sự kiện, nhớ hay quên. Ngữ pháp thì khác: nhớ
được mẫu 〜ばかり không có nghĩa là dùng đúng trong câu mới. Bunpro cũng xếp lịch ngữ pháp bằng SRS và người dùng than
"cùng câu lặp lại mãi, nhớ câu chứ không nhớ mẫu" (diễn đàn Bunpro). **Bằng chứng cho cách làm này: yếu.**

Điểm mạnh có sẵn của Sakubun: mỗi lượt AI **soạn câu mới** cho mẫu ngữ pháp, nên người học không thể học thuộc câu.
Đây là lợi thế thật so với Bunpro, nên giữ và nói rõ trong sản phẩm.

Điểm cần sửa: Ôn nhanh trên web dùng câu ví dụ cố định (OpenJLPT), nên rơi lại đúng vấn đề của Bunpro. Gợi ý: xoay
vòng nhiều câu ví dụ cho mỗi mục, và tách **"nhận ra mẫu"** (Ôn nhanh) với **"dùng được mẫu"** (dịch với AI) thành
hai mức thành thạo khác nhau.

## B5. Xen kẽ (interleaving) và phân biệt mẫu dễ nhầm

Meta-analysis của Brunmair và Richter (2019): xen kẽ giúp khi cần **phân biệt các loại giống nhau**, nhưng với học từ
rời thì có khi còn hại. **Mạnh** cho phân biệt, **không** cho từ rời.

Hệ quả: bài tập **đối chiếu mẫu dễ nhầm** (〜そうだ / 〜ようだ / 〜らしい; は / が; 〜たら / 〜ば / 〜と / 〜なら): một
câu, chọn mẫu đúng, giải thích ngắn khác biệt. Đây là chỗ người học trung cấp kẹt nhiều nhất.

## B6. Khó khăn có ích (desirable difficulties, Bjork)

Bài tập khó vừa phải (phải cố nhớ, phải tự sinh) làm học chậm hơn trước mắt nhưng nhớ lâu hơn. Quá khó thì người học
bỏ. **Mạnh** cho nguyên tắc, cách áp dụng phụ thuộc người.

## B7. Hai chiều: nhận diện và sản sinh

Biết một từ khi đọc (Nhật sang Việt) dễ hơn dùng được nó (Việt sang Nhật). Học chiều nào thì mạnh chiều đó. **Mạnh.**
Sakubun có chiều dịch xen kẽ (ALTERNATING), đúng hướng. Nhưng FSRS chỉ có **một** trạng thái cho mỗi mục, trong khi
hai chiều có độ khó rất khác. Anki tách thành hai thẻ. Nên cân nhắc tách trạng thái theo chiều (thay đổi schema, cần
quyết định của thien).

## B8. Nợ ôn tập (review debt) và bỏ học

Kinh nghiệm cộng đồng Anki và WaniKani: nguyên nhân bỏ học hàng đầu là **đống thẻ đến hạn dồn lại** sau vài ngày
nghỉ. Mở app thấy 300 thẻ thì đóng app. **Vừa** (kinh nghiệm người dùng, ít nghiên cứu chính thức).

Tài khoản của thien ngày 2026-11-04 có 84 thẻ đến hạn và chuỗi ngày 0, khớp đúng hiện tượng này.

Hệ quả: **chế độ trở lại** sau khi nghỉ: không cho thêm mục mới, chia nợ ra vài ngày theo thứ tự "sắp quên nhất
trước" (FSRS cho xác suất nhớ hiện tại), và nói rõ "hôm nay chỉ cần 20 thẻ".

## B9. Mục "đỉa" (leech)

Mục quên đi quên lại (lapses cao) tốn nhiều thời gian nhất. Anki đánh dấu và tạm dừng chúng. Cách tốt hơn: đổi cách
học (thêm câu, thêm mẹo nhớ, đối chiếu với mục dễ nhầm, liên hệ Hán Việt). **Vừa.**

## Nguồn

- Cepeda, N. và cộng sự (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin* 132(3). https://pubmed.ncbi.nlm.nih.gov/16719566/
- Kim, S.K. và Webb, S. (2022). The effects of spaced practice on second language learning: a meta-analysis. *Language Learning* 72(1).
- Adesope, O., Trevisan, D. và Sundararajan, N. (2017). Rethinking the use of tests. *Review of Educational Research* 87(3). https://journals.sagepub.com/doi/10.3102/0034654316689306
- Roediger, H. và Karpicke, J. (2006). Test-enhanced learning. *Psychological Science* 17(3).
- Benchmark of Spaced Repetition Algorithms (open-spaced-repetition). https://expertium.github.io/Benchmark.html
- Brunmair, M. và Richter, T. (2019). Similarity matters: a meta-analysis of interleaved learning. *Psychological Bulletin* 145(11).
- Bjork, R. (1994). Memory and metamemory considerations in the training of human beings.
- Diễn đàn Bunpro về câu lặp lại: https://community.bunpro.jp/t/bunpro-is-making-me-practice-the-same-grammar-and-worse-the-same-sentences-endlessly-what-do/52373
