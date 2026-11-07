# A. Thụ đắc ngôn ngữ thứ hai (SLA): điều gì thật sự giúp người lớn học ngoại ngữ

Mức bằng chứng: **mạnh** = nhiều meta-analysis cùng chiều; **vừa** = vài nghiên cứu tốt hoặc meta-analysis có
tranh cãi; **yếu** = lý thuyết, ý kiến chuyên gia, kinh nghiệm sản phẩm.

## A1. Bốn nhánh cân bằng (Nation)

Paul Nation chia thời gian học hiệu quả thành bốn nhánh xấp xỉ bằng nhau:

1. **Đầu vào tập trung vào nghĩa**: nghe và đọc nội dung mình gần hiểu hết.
2. **Đầu ra tập trung vào nghĩa**: nói và viết để truyền đạt điều mình muốn nói.
3. **Học tập trung vào ngôn ngữ**: học từ, ngữ pháp, phát âm có chủ đích (thẻ SRS, giải thích ngữ pháp).
4. **Luyện độ trôi chảy**: dùng lại thứ đã biết, nhanh hơn, dưới áp lực thời gian nhẹ.

Mức bằng chứng: **vừa** (đây là khung thiết kế tổng hợp từ nhiều nghiên cứu, không phải một thí nghiệm).

**Hệ quả cho Sakubun**: hôm nay Sakubun mạnh ở nhánh 3 (SRS, Ôn nhanh) và một phần nhánh 2 (dịch câu Việt sang Nhật
với AI chấm). Nhánh 1 (nghe, đọc nhiều) và nhánh 4 (trôi chảy) gần như trống. Đây là lỗ hổng lớn nhất về mặt
phương pháp.

## A2. Đầu vào hiểu được và ngưỡng từ vựng

- Krashen cho rằng chỉ cần đầu vào hiểu được là đủ. Phần "đủ" bị phản bác rộng rãi (người học nghe nhiều năm vẫn
  sai ngữ pháp nếu không có đầu ra và phản hồi), nhưng phần "đầu vào nhiều là cần thiết" được chấp nhận. **Vừa.**
- Để hiểu một bài đọc mà không cần tra, người học cần biết khoảng **98%** số từ trong bài; 95% là mức hiểu tối
  thiểu có trợ giúp (Hu và Nation 2000; Laufer và Ravenhorst-Kalovski 2010). **Mạnh** cho tiếng Anh, chưa kiểm
  nhiều cho tiếng Nhật.
- Học từ ngẫu nhiên qua đọc thì chậm: một từ cần gặp khoảng 8 đến 10 lần trở lên mới nhớ chắc (Webb 2007 và các
  nghiên cứu sau). Học có chủ đích (thẻ) nhanh hơn nhiều cho liên kết hình thức và nghĩa, nhưng không dạy cách dùng.
  Kết hợp cả hai là tốt nhất. **Mạnh.**

**Hệ quả**: Sakubun đã biết người học thuộc những mục nào (FSRS). Từ đó có thể sinh hoặc chọn bài đọc và bài nghe mà
95–98% từ đã biết, chỉ còn 1–3 từ mới: đây là việc app SRS biết rõ kho từ của người học làm tốt hơn hẳn sách.

## A3. Đầu ra, nhận ra lỗ hổng và tương tác

- **Giả thuyết đầu ra** (Swain): khi phải nói hoặc viết, người học nhận ra mình thiếu gì, rồi chú ý hơn khi gặp lại.
  **Vừa.**
- **Tương tác** (Long): hội thoại có thương lượng nghĩa giúp học; meta-analysis của Mackey và Goo (2007) cho hiệu
  quả dương rõ ở cả kiểm tra ngay và kiểm tra trễ. **Mạnh.**
- **Chú ý** (Schmidt): người học chỉ học được thứ mình để ý thấy. **Vừa** (khó đo, nhưng ít ai bác).

**Hệ quả**: vòng dịch câu Việt sang Nhật của Sakubun (AI soạn câu, người học dịch, AI chấm) là một dạng đầu ra có
phản hồi, đúng hướng. Kaiwa hiện là kịch bản tĩnh để đọc và nghe; phần tương tác thật chỉ có ở nhập vai qua
claude.ai.

## A4. Phản hồi sửa lỗi

- Meta-analysis của Li (2010) và Lyster và Saito (2010): phản hồi sửa lỗi có hiệu quả từ vừa đến lớn, giữ được ở bài
  kiểm tra trễ. **Mạnh.**
- **Gợi ý để người học tự sửa** (prompt: "chỗ trợ từ chưa đúng, thử lại") thường hiệu quả hơn **nói lại câu đúng**
  (recast) cho những lỗi người học đã có kiến thức. Với kiến thức hoàn toàn mới thì đưa đáp án rõ ràng tốt hơn.
  **Vừa.**
- Phản hồi tập trung vào một vài loại lỗi dễ nhớ hơn phản hồi sửa hết mọi thứ. **Vừa** (kết quả không đồng nhất).

**Hệ quả**: prompt `hoc` hiện bảo AI đưa câu mẫu và lỗi chính ngay. Nên thử bước **"thử lại một lần"**: AI chỉ ra
vùng lỗi, người học sửa, rồi mới xem câu mẫu. Lỗi lặp lại (errorTags) nên gom thành **hồ sơ lỗi** để luyện riêng.

## A5. Tự động hoá kỹ năng (DeKeyser)

Kiến thức đi từ "biết luật" (khai báo) sang "làm được" (thủ tục) rồi "làm nhanh không cần nghĩ" (tự động). Bước sau
cần luyện tập nhiều, có mục đích, có phản hồi và dần dần thêm áp lực thời gian. **Vừa.**

**Hệ quả**: thêm chế độ trôi chảy: câu ngắn đã biết, trả lời nhanh, có đồng hồ nhẹ (ví dụ phương pháp 4/3/2 của
Nation: nói cùng một nội dung trong 4, rồi 3, rồi 2 phút).

## A6. Cụm từ cố định (chunks)

Người bản ngữ dùng rất nhiều cụm cố định (よろしくお願いします, 〜てもいいですか, 気をつけて). Học cả cụm giúp nói
trôi chảy và đúng tự nhiên hơn ghép từng từ. **Vừa đến mạnh.**

**Hệ quả**: mục trong kho không nên chỉ là từ đơn và mẫu ngữ pháp. Cần loại mục "cụm / câu mẫu dùng ngay".

## A7. Dịch và tiếng mẹ đẻ

Dùng tiếng mẹ đẻ có kiểm soát (giải thích, đối chiếu, dịch) giúp người lớn hiểu nhanh hơn (Cook 2010, Hall và Cook
2012). Nhưng nếu mọi bài tập đều đi qua tiếng Việt thì người học khó hình thành phản xạ nghĩ thẳng bằng tiếng Nhật.
**Vừa.**

**Hệ quả**: dịch câu là thế mạnh (và là tên app), nhưng cần thêm bài tập không qua tiếng Việt: trả lời câu hỏi bằng
tiếng Nhật, mô tả tình huống, nghe rồi phản hồi.

## A8. Học theo nhiệm vụ (TBLT)

Học bằng nhiệm vụ có mục đích thật (đặt món, hỏi đường, phỏng vấn xin việc) cho hiệu quả lớn trong meta-analysis
của Bryfonski và McKay (2019). **Vừa đến mạnh** (phần lớn nghiên cứu trong lớp học, không phải app).

**Hệ quả**: Kaiwa có thể đi từ "kịch bản để đọc" sang "nhiệm vụ để hoàn thành": AI đóng vai, người học phải đạt mục
tiêu (đặt được phòng khách sạn với 2 yêu cầu), AI chấm theo mục tiêu chứ không theo từng chữ.

## A9. Lo âu và sự sẵn lòng giao tiếp

Lo âu khi nói làm giảm kết quả (Horwitz và cộng sự 1986, nhiều nghiên cứu sau). Nói với AI có thể giảm lo âu vì
không sợ bị phán xét. **Yếu đến vừa** (nghiên cứu về AI còn mới, mẫu nhỏ).

## Lý lẽ phản đối mạnh nhất cho cả mảng

Phần lớn nghiên cứu SLA làm trong lớp học, với người học tiếng Anh, trong vài tuần. Tự học với app trong nhiều năm
khác hẳn. Vì vậy mỗi đề xuất rút ra từ đây cần **đo lại trên chính người dùng Sakubun** (tỷ lệ nhớ, thời gian học,
tỷ lệ bỏ học) thay vì tin là chắc chắn đúng.

## Nguồn

- Nation, I.S.P. (2007). The four strands. *Innovation in Language Learning and Teaching* 1(1).
- Hu, M. và Nation, P. (2000). Unknown vocabulary density and reading comprehension. *Reading in a Foreign Language* 13(1).
- Laufer, B. và Ravenhorst-Kalovski, G. (2010). Lexical threshold revisited. *Reading in a Foreign Language* 22(1).
- Webb, S. (2007). The effects of repetition on vocabulary knowledge. *Applied Linguistics* 28(1).
- Mackey, A. và Goo, J. (2007). Interaction research in SLA: a meta-analysis. Trong *Conversational Interaction in SLA*, OUP.
- Li, S. (2010). The effectiveness of corrective feedback in SLA: a meta-analysis. *Language Learning* 60(2).
- Lyster, R. và Saito, K. (2010). Oral feedback in classroom SLA: a meta-analysis. *SSLA* 32(2). https://www.cambridge.org/core/product/4999EE1C8379B2BF026B148EAF373CA1
- Loewen, S. và Sato, M. (2018). Interaction and instructed SLA. *Language Teaching* 51(3). https://www.cambridge.org/core/product/78A156EE200F744F5978F99BFB073DBE
- DeKeyser, R. (2007). *Practice in a Second Language*. CUP.
- Cook, G. (2010). *Translation in Language Teaching*. OUP.
- Bryfonski, L. và McKay, T. (2019). TBLT implementation and evaluation: a meta-analysis. *Language Teaching Research* 23(5).
- Horwitz, E., Horwitz, M. và Cope, J. (1986). Foreign language classroom anxiety. *Modern Language Journal* 70(2).
