# Kế hoạch: luyện dịch dễ đọc hơn, độ khó tăng dần, chọn cấp mới

- Ngày: 2026-11-07. Bản thảo cho thien: https://claude.ai/artifact/K8zgiK3WBQ1om9o5AYBw7c
- Duyệt: thien, 2026-11-07 19:35 UTC: (1) theo đề xuất, mỗi loại một cấp đang học, trộn 3:1; dùng một thời gian
  thấy không ổn thì làm lại theo cách 2 (tích nhiều cấp, thêm ô cho từ vựng); (2) giữ trần bậc theo cấp mục;
  (3) khối kết quả phần A ổn; (4) thứ tự theo đề xuất: R1–R4, rồi Kaiwa, rồi kế hoạch kanji.
- Khi làm R1 (2026-11-07): danh sách OpenJLPT xếp mỗi cấp theo thứ tự あいうえお, không theo độ thường gặp, nên
  trong một cấp mục được xếp theo một thứ tự trộn cố định (mục người học tự thêm vẫn đi trước). Ô `vocabCeiling` cũ
  đã bị bỏ qua từ 7.x, nên khi đọc cài đặt cũ, từ vựng đang học lấy bằng cấp ngữ pháp đang học, không đọc ô đó.
- Khi làm R2 + R3 (2026-11-07): bậc câu đếm mọi lần chấm mục đó trong `ReviewLog` (cả Ôn nhanh trên web), lần Quên
  xoá luôn số lần "vượt trần". Ở chế độ tự động, chiều dịch đổi sang Việt → Nhật từ bậc 3 (thay cho luật độ ổn định
  21 ngày). Từ vựng xung quanh lấy cấp dễ hơn giữa cấp của mục và cấp từ vựng đang học, cho tới khi mục vượt trần.
  Cảnh và lỗi trùng câu viết bằng tiếng Anh cho Claude, như các dòng khác của MCP.
- Khi làm R4 (2026-11-07): bỏ dấu ✓ ✗ vì luật repo cấm emoji (`lib/design/no-emoji.test.ts`), dòng đầu chỉ ghi chữ
  ("Đúng · Nhớ", "Chưa đúng · Quên"). Khó (2) hiện "Đúng ý, còn lỗi · Khó" kèm dòng Lỗi chính. `feedback` giữ giới hạn 300 ký
  tự sẵn có thay vì 120, để Claude không bị từ chối vì một câu hơi dài; mô tả tool vẫn dặn một dòng.

## Tóm tắt

Em đề xuất sửa vòng luyện dịch theo 4 ý anh gửi ngày 2026-11-07, chia thành 5 PR nhỏ. Không PR nào cần migration: bậc câu tính từ lịch sử ôn, cài đặt mới nằm trong JSON sẵn có.

| Ý của anh | Đề xuất |
| --- | --- |
| Phản hồi của AI sơ sài, chỉ nói khi sai | Mỗi lượt có một khối kết quả cố định: đúng/sai, đáp án tham khảo, lỗi chính, điểm |
| Câu dịch không khó lên khi mục đã thuộc | Mỗi mục có bậc khó 1–5, tăng khi gần đây toàn Nhớ/Dễ, giảm khi Quên |
| Câu lặp, ít đa dạng | Server gửi kèm các câu đã dùng cho mục đó và bắt đổi ngữ cảnh; chặn câu trùng |
| Từ vựng luôn N5, cách chọn cấp chưa hay | Chọn cấp riêng cho ngữ pháp và từ vựng, mục mới ưu tiên cấp cao nhất đã chọn |

## Hiện nay app làm thế nào

Em đã đọc code trên `main` và gọi thử MCP bằng tài khoản của anh. Có 4 nguyên nhân khớp đúng với những gì anh thấy.

1. **Độ khó chỉ có 2 nấc.** `composeSpec` (`lib/domain/compose.ts`) chỉ xét cấp JLPT của mục và mục còn mới hay không. Mục mới được hạ một cấp, còn lại giữ nguyên cấp. Ôn \~は N5 lần thứ 2 hay lần thứ 20 thì câu vẫn dài 8–16 ký tự, cùng một kiểu. Bảng 5 bậc câu (`DIFFICULTY_ANCHORS`) đã có trong code nhưng vòng dịch mới không dùng tới.
2. **Câu giống nhau giữa các tài khoản.** `next_turn` gửi kèm câu ví dụ của mục (`example: …`). Claude thường chép hoặc sửa nhẹ câu này, nên lần nào cũng ra gần như cùng một câu, ở tài khoản nào cũng vậy. Server cũng không cho Claude biết những câu đã dùng trước đó (bảng `Turn` có lưu nhưng không được đọc lại).
3. **Phản hồi phụ thuộc Claude tự viết.** `grade_turn` chỉ trả về "graded 3 · next review in 6d" và dặn "give one or two lines of feedback". Server không gửi lại câu mẫu, nên khi anh trả lời đúng, Claude hay bỏ qua, không có đáp án tham khảo và cũng không có bố cục cố định.
4. **Từ vựng mới luôn là N5.** Mục mới được lấy từ mọi cấp từ N5 tới cấp ngữ pháp khó nhất anh chọn, xếp theo ngày thêm vào kho (`lib/app/queue.ts`). Kho của anh được nạp N5 trước, nên 15 từ mới mỗi ngày sẽ là N5 cho tới khi hết gần 700 từ N5. Cài đặt chỉ có một ô "Cấp JLPT" (`grammarLevels`). Từ vựng không có ô riêng; ô `vocabCeiling` cũ vẫn còn trong schema nhưng không ai đọc tới.

## A. Phản hồi mỗi lượt: luôn có đúng/sai và đáp án tham khảo

Sau mỗi câu trả lời, Claude in một khối kết quả có bố cục cố định, dù anh trả lời đúng hay sai. Server dựng sẵn khối này trong kết quả `grade_turn` (câu mẫu lấy từ bảng `Turn`), Claude chỉ chép ra và điền phần nhận xét.

Ví dụ khi trả lời đúng:

```markdown
**✓ Đúng · Nhớ** · ôn lại sau 6 ngày

> **Bạn viết:** 先週、友達と映画を見に行きました。
> **Tham khảo:** 先週、友達と映画を見に行きました。

**Cách nói khác:** 先週、友だちと映画館へ行きました。
```

Ví dụ khi sai:

```markdown
**✗ Chưa đúng · Quên** · ôn lại sau 10 phút

> **Bạn viết:** 友達**に**映画を見ました。
> **Tham khảo:** 友達**と**映画を見に行きました。

**Lỗi chính:** 「と」 là "cùng với"; 「に」 ở đây đổi nghĩa thành "cho bạn xem phim".
```

Những gì đổi:

- Kết quả `grade_turn` trả về nguyên khối trên, kèm lệnh `next:` "chép khối này, chỉ điền dòng Lỗi chính hoặc Cách nói khác". Claude không phải tự nhớ câu mẫu nữa.
- `grade_turn` nhận thêm `feedback` (một câu, tối đa 120 ký tự). Server lưu nó vào cột `Turn.feedback` (đã có sẵn), nên trang Lịch sử cũng hiện được.
- Bài học từ issue #28 cũ: server không ép được Claude in ra. Vì vậy em viết khối thật ngắn để Claude dễ chép, và điểm luôn nằm trong Lịch sử trên web. Em sẽ thử 20 lượt thật trong claude.ai để đếm xem bao nhiêu lượt Claude in đủ khối.
- Giữ điểm mạnh anh thích: lượt đúng chỉ có 3 dòng, không giảng dài.

## B. Độ khó tăng dần theo từng mục

Mỗi mục có một **bậc câu từ 1 tới 5**, tính lại sau mỗi lần chấm từ lịch sử ôn của chính mục đó (`ReviewLog`). Không cần thêm cột mới. Bậc quyết định cấu trúc câu (5 bậc đã có trong code), độ dài và chiều dịch.

**Luật tính bậc** (hàm thuần trong `lib/domain/`, có test):

1. Mục mới bắt đầu ở bậc 1.
2. Mỗi lần Dễ (4): lên 1 bậc.
3. Nhớ (3) hai lần liền nhau: lên 1 bậc. Lần có gợi ý thì không tính là lên.
4. Khó (2): giữ nguyên bậc, đếm lại chuỗi Nhớ từ đầu.
5. Quên (1): xuống 1 bậc, không dưới 1.
6. Trần theo cấp của mục: N5 tối đa bậc 3, N4 bậc 4, N3 trở lên bậc 5. Khi đã chạm trần mà vẫn toàn Nhớ/Dễ, từ vựng xung quanh được nâng lên cấp anh đang học. Nhờ vậy \~は N5 vẫn khó lên dần nhưng không thành câu N1.

**Bậc đổi những gì trong câu:**

| Bậc | Cấu trúc (theo `DIFFICULTY_ANCHORS`) | Độ dài tiếng Nhật | Chiều dịch |
| --- | --- | --- | --- |
| 1 | Một mệnh đề, trợ từ cơ bản | 8–16 ký tự | Nhật → Việt |
| 2 | Hai mệnh đề nối bằng 〜て・〜から | 12–22 | Nhật → Việt |
| 3 | Mệnh đề lồng (quan hệ, 〜と、こと・の) | 16–28 | Việt → Nhật |
| 4 | Lồng hai tầng, sắc thái は/が, も・こそ・さえ | 20–34 | Việt → Nhật |
| 5 | Đảo trật tự, lược chủ ngữ, nhiều lớp thể thái | 26–42 | Việt → Nhật |

**Ví dụ với \~は (N5, trần bậc 3):** lần 1 mới, bậc 1 (これは本です). Nhớ, Nhớ thì lên bậc 2 (私は学生で、兄は会社員です). Dễ thì lên bậc 3, đổi sang Việt → Nhật (Người mà tôi gặp hôm qua là giáo viên). Tiếp tục Dễ thì giữ bậc 3 nhưng từ vựng xung quanh lên N3. Quên một lần thì về bậc 2.

Vì sao làm thế này: FSRS vẫn lo **khi nào** ôn, bậc câu chỉ lo **câu khó cỡ nào**. Hai việc không lẫn vào nhau, và `recordReviews()` vẫn là lối duy nhất ghi lịch FSRS. Một lần Quên chỉ lùi một bậc (không về đầu), để anh không phải làm lại câu quá dễ. Mức "Nhớ hai lần liền" giống cách các phần mềm luyện tập nâng bậc: một lần đúng có thể là may mắn, hai lần thì đã vững.

## C. Câu đa dạng, không lặp câu cũ

Server ngừng đưa câu ví dụ của mục cho Claude, cho Claude biết những câu anh đã làm, và từ chối câu trùng.

- `next_turn` bỏ dòng `example:`, chỉ giữ nghĩa và cấu trúc. Thêm dòng `avoid:` gồm 3 câu gần nhất của mục này (lấy từ bảng `Turn`).
- Thêm dòng `scene:` luân phiên theo số lần đã làm mục đó: đời sống, đi làm, trường học, du lịch, mua sắm, bạn bè, tin tức, phim và anime. Nếu anh có đặt chủ đề trong Cài đặt (`topics`) thì dùng chủ đề của anh trước.
- `stage_turn` từ chối nếu câu tiếng Nhật (sau khi bỏ dấu câu và khoảng trắng) trùng một trong 10 câu gần nhất của mục, hoặc trùng câu ví dụ trên thẻ. Lỗi trả về ngắn gọn: "Câu này đã dùng. Viết câu khác trong cảnh \<scene>."
- Câu ví dụ trên thẻ vẫn dùng cho Ôn nhanh trên web như cũ.

## D. Chọn cấp cho ngữ pháp và từ vựng

Em đề xuất đổi từ "tích các cấp" sang **mỗi loại một cấp đang học**. Ngữ pháp và từ vựng chọn riêng, ví dụ ngữ pháp N3 và từ vựng N2.

- **Mục mới mỗi ngày:** 3 trong 4 mục lấy ở cấp đang học. Mục thứ 4 lấy ở cấp dưới mà anh chưa học hết, để lấp lỗ hổng. Trong một cấp, mục đi theo thứ tự cố định của danh sách OpenJLPT (em sẽ kiểm tra danh sách này có xếp theo độ thường gặp không), không xếp theo ngày nạp nữa. Lỗi "từ vựng luôn N5" hết từ đây.
- **Gợi ý lên cấp:** khi 80% mục của cấp đang học đã qua giai đoạn mới, trang Phân tích hiện một dòng "Lên N2?" kèm nút. Anh bấm mới đổi, app không tự đổi.
- **Cài đặt:** hai ô chọn "Ngữ pháp đang học" và "Từ vựng đang học", mỗi ô N5–N1, thay cho ô "Cấp JLPT" tích nhiều cấp.
- **Dữ liệu:** cài đặt lưu dạng JSON nên không cần migration. Bản cũ được đọc sang bản mới: ngữ pháp đang học là cấp khó nhất anh đã tích. Từ vựng đang học lấy từ `vocabCeiling` nếu có, không thì cùng cấp với ngữ pháp.

Nếu anh muốn giữ cách tích nhiều cấp, phương án nhỏ hơn là: thêm ô tích cấp cho từ vựng và xếp mục mới từ cấp khó nhất đã tích xuống.

## Chia PR, rủi ro, cách đo

| PR | Nội dung | Rủi ro | Xong khi |
| --- | --- | --- | --- |
| R1 | D: hai ô cấp đang học, trộn 3:1, đọc cài đặt cũ sang mới | high (hành vi học) | test hàng đợi với kho N5–N1, ảnh Cài đặt 1440 + 390 |
| R2 | B: hàm tính bậc câu từ `ReviewLog`, `next_turn` gửi bậc và cấu trúc | high | test bảng chuyển bậc, giới hạn token của tool không vượt |
| R3 | C: bỏ `example:`, thêm `avoid:` và `scene:`, `stage_turn` chặn câu trùng | medium | test chặn trùng |
| R4 | A: khối kết quả trong `grade_turn`, lưu `feedback`, Lịch sử hiện nhận xét | medium | 20 lượt thật trong claude.ai |
| R5 | Gợi ý lên cấp trên Phân tích | high (UI) | ảnh trước/sau, anh duyệt |

R1 làm trước vì đó là lỗi anh đang gặp hằng ngày. R2 và R3 đi cùng nhau vì cùng sửa `next_turn`.

**Rủi ro chính:**

- Tool dài thêm thì tốn token hơn, mà anh hay dùng gói Free. `avoid:` chỉ gửi 3 câu, khối kết quả giữ dưới 6 dòng, và test `token-budget` sẽ chặn nếu vượt.
- Claude có thể không chép khối kết quả. Khi đó điểm vẫn nằm trong Lịch sử, và em sẽ đo tỉ lệ Claude chép đúng trước khi coi là xong.

**Cách đo hiệu quả** (so trước và sau 2 tuần, trên dữ liệu của anh):

- Tỉ lệ câu trùng của cùng một mục: mục tiêu dưới 5%.
- Số mục đạt bậc 3 trở lên.
- Tỉ lệ Quên ở câu bậc cao: nếu trên 30% thì cần hạ mức lên bậc.

## Cần anh trả lời

1. **Cấp:** "mỗi loại một cấp đang học, trộn 3:1 với cấp dưới" (em đề xuất), hay giữ tích nhiều cấp và chỉ thêm ô cho từ vựng?
2. **Trần bậc theo cấp mục** (N5 tối đa bậc 3): giữ, hay cho mọi mục lên tới bậc 5?
3. **Khối kết quả phần A:** bố cục và độ dài trong 2 ví dụ trên đã ổn chưa? Anh muốn thêm gì, ví dụ cách đọc, Hán Việt hay nghĩa từng từ?
4. **Thứ tự:** R1 → R2 + R3 → R4 → R5, xen với Kaiwa a–d và kanji thế nào? Em đề xuất làm hết R1–R4 trước vì đây là lõi, rồi Kaiwa a, rồi kế hoạch kanji.

Anh duyệt xong thì em chép bản này vào `docs/plans/2026-11-07-translation-difficulty.md` trước khi code, đúng luật của repo.
