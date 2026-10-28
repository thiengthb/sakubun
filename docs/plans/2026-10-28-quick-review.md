# Kế hoạch C: làm lại Ôn nhanh

- Ngày: 2026-10-28. Trạng thái: **chờ thien duyệt** (chưa code).
- Phần C của `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md`.
- Lời thien (2026-10-27): "đáp án chưa có phần dịch, các câu ngữ pháp nên đưa thành các câu ví dụ thì hay hơn, để
  người dùng biết trường hợp sử dụng của nó. Cần một sự cải thiện sâu hơn cho phần ôn nhanh." Và về cơ chế quiz gộp từ
  WordQuiz: "muốn làm kĩ các phần cơ chế của nó, hiện tại chưa kiểm soát kĩ lắm nên còn một vài chỗ hơi off".

## Đo trên dữ liệu thật

Chạy đúng code hôm nay (`lib/app/quick-review.ts`, `lib/domain/cloze.ts`) trên toàn bộ kho OpenJLPT (518 ngữ pháp,
7.625 từ vựng), hỏi: thẻ của mục này trông ra sao khi đã gặp?

| Ngữ pháp (518)                                                                                              | Số mục |     |
| ----------------------------------------------------------------------------------------------------------- | ------ | --- |
| Điền chỗ trống được                                                                                         | 276    | 53% |
| Có câu ví dụ chứa mẫu, nhưng code **không tìm ra** mẫu trong câu, nên thẻ chỉ còn mỗi mẫu `〜が（subject）` | 223    | 43% |
| Mẫu một chữ (`〜は`, `〜を`, `〜ね`), chỉ gạch chân                                                         | 19     | 4%  |

Vì sao 223 mẫu không tìm ra: nhãn tiếng Anh trong tên mẫu (`〜が（subject）` thành `がsubject`, 44 mẫu), hai dạng
trong một tên (`〜くて / 〜で`, 85), mẫu tách đôi (`全然〜ない`, `〜しか〜ない`, 33), mẫu đã chia (`〜すぎる` trong
`飲みすぎて`, 61). Câu có sẵn, chỉ là code so chữ quá thẳng.

| Từ vựng (7.625)                                                                                     | Số mục |     |
| --------------------------------------------------------------------------------------------------- | ------ | --- |
| Điền chỗ trống được                                                                                 | 5.002  | 66% |
| Từ đã chia trong câu (`明るい` trong `明るくなっていく`), chỉ gạch chân, và chỉ gạch được phần `明` | 1.119  | 15% |
| Từ một chữ (`青`, `朝`, `足`), chỉ gạch chân                                                        | 666    | 9%  |
| Câu có từ nhưng viết khác (`いす` / `椅子`, `あそこ` / `アソコ`), thẻ trống                         | 305    | 4%  |
| Không có câu ví dụ                                                                                  | 520    | 7%  |

## Những chỗ "hơi off", cụ thể

Ảnh chụp bản hiện tại (1440, dữ liệu OpenJLPT thật) nằm trong `docs/plans/2026-10-28-quick-review/`.

1. **Đáp án không có dịch.** Câu OpenJLPT chỉ có bản tiếng Anh, Ôn nhanh bỏ tiếng Anh, nên chỉ mục có thẻ giải thích
   do AI viết mới có câu dịch (`before-vocab-flip.png`: `外はだんだん明るくなっていく。` không có nghĩa câu).
2. **43% thẻ ngữ pháp không có câu**, chỉ còn tên mẫu kèm nhãn tiếng Anh (`before-grammar-bare.png`), dù câu ví dụ có
   sẵn trong kho. Đây là chỗ thien thấy "ngữ pháp nên là câu ví dụ".
3. **Đáp án sai loại từ, đoán được mà không cần biết nghĩa.** Phương án nhiễu lấy ngẫu nhiên cùng loại (ngữ pháp
   hoặc từ vựng), không xét từ loại hay cách nối. `この学校は男子よりも女子が（　）。` có bốn lựa chọn `開く`,
   `生まれる`, `多い`, `あさって`: chỉ `多い` đứng được trước `。` về ngữ pháp (`before-vocab-cloze.png`).
4. **Nhãn tiếng Anh và mẫu tách đôi lọt vào lựa chọn**: `〜か（or）`, `〜な（na-adjective）`, `全然〜ない`
   (`before-grammar-cloze.png`). Chọn xong, câu hiện `今日はきのう〜より寒いです` (dư dấu `〜`).
5. **Phương án nhiễu luôn là cùng một nhóm khoảng 300 mục**: code lấy 300 mục đầu tiên theo `id` của các cấp gần
   kề, nên với kho 7.600 từ, ngày nào cũng gặp lại cùng những từ nhiễu đó và học cách loại chúng.
6. **Tài khoản mới (bắt đầu trống từ L4) gần như không có thẻ điền chỗ trống**: nhiễu chỉ lấy từ kho riêng, kho
   dưới 4 mục cùng loại thì mọi thẻ thành thẻ lật.
7. **Đoán trúng tính như nhớ.** Chọn đúng luôn là "Nhớ" (Good), nên một lần đoán may 1/4 vẫn đẩy lịch ra xa.
8. **Sai rồi thì hết buổi mới gặp lại.** Thẻ chọn sai về bước học lại (vài phút), nhưng buổi ôn giữ nguyên 20 thẻ lúc
   mở trang, nên phải tải lại trang. Thẻ gặp lại trong ngày có đúng câu và đúng thứ tự lựa chọn (hạt giống theo ngày),
   nên nhớ vị trí là chọn đúng.
9. **Furigana không bật được** trên câu OpenJLPT: nguồn có furigana (`{私|わたし}は…`) nhưng lúc nhập chỉ giữ chữ, nút
   あ không đổi gì.
10. **Thẻ mới bị chấm ngay lần đầu thấy**: mục chưa học bao giờ vẫn hỏi "nghĩa là gì?" rồi bắt chọn Quên/Khó/Nhớ/Dễ.
11. **Một số câu Tatoeba không hợp để học**: `お前はまだ「青い」な。` (nghĩa bóng), `もうスミスさんに会われましたね。`
    (kính ngữ cho từ N5 `会う`), `先生、アソコがかゆいんです。` (thô).

## Đề xuất

### Dữ liệu: câu ví dụ đầy đủ, soạn một lần, nằm trong repo

Một file tĩnh mới `data/openjlpt/examples.json`, khoá theo id OpenJLPT, mỗi câu có:

- `ja`, `ruby` (furigana lấy từ nguồn, đổi sang dạng `漢字[かな]` app đang dùng), `vi` (câu dịch tiếng Việt);
- `span`: đúng đoạn chữ của mục trong câu (`飲みすぎ`, `しか`…`ない` thành hai đoạn), để gạch chân và đục lỗ
  chính xác thay vì so chữ;
- `skip: true` cho câu không hợp để học (mục 11), kèm lý do.

Thêm `formationVi` cho ngữ pháp (`Noun + は` thành `Danh từ + は`) và `pos` cho từ vựng (đã có trong nguồn).

Soạn bằng một script chạy theo lô như `scripts/openjlpt/translate.mjs` đã làm cho nghĩa từ, kết quả commit vào repo,
có test kiểm: `span` phải nằm đúng trong `ja`, `ruby` bỏ ngoặc phải ra đúng `ja`, `vi` không rỗng. Mẫu 50 câu ra
`sample-review.md` cho thien xem trước khi chạy cả bộ. Web vẫn không tự sinh câu: đây là dữ liệu cố định như `vi.json`.

Không cần migration: Ôn nhanh tra file này theo (loại, mục) lúc dựng thẻ, nên mục đã nhập, đã lấy từ Kho chung hay
tự thêm đều được hưởng nếu trùng mục OpenJLPT.

### Thẻ: luôn bắt đầu bằng câu

- **Mục mới là thẻ giới thiệu**, không chấm: câu ví dụ có gạch chân, mở sẵn nghĩa, cách nối, câu dịch; một nút "Đã
  xem" (ghi Good như hôm nay, để mục vào bước học). Lần gặp sau mới là kiểm tra.
- **Mục đã gặp**: điền chỗ trống khi có câu đục được; không thì thẻ lật với câu gạch chân. Ngữ pháp không bao giờ
  còn thẻ chỉ có tên mẫu khi kho có câu.
- **Đáp án** (sau khi trả lời): câu điền đủ, câu dịch tiếng Việt, nghĩa, cách nối (ngữ pháp) hoặc Hán Việt (từ),
  lưu ý. Câu dịch chỉ hiện ở đáp án, không bao giờ ở mặt hỏi, để không lộ đáp án.
- **Không có câu nào**: thẻ ghi rõ "Mục này chưa có câu ví dụ" và gợi ý nhờ Claude viết thẻ giải thích.

### Cơ chế điền chỗ trống (phần WordQuiz)

- **Nhiễu cùng dạng**: từ vựng cùng từ loại (động từ với động từ, tính từ -i với tính từ -i…), ngữ pháp cùng cách nối
  (sau danh từ, sau động từ thể て…). Lựa chọn hiện mẫu đã bỏ nhãn tiếng Anh; hai mẫu trùng chữ (`〜に（time）`,
  `〜に（destination）`) không bao giờ cùng xuất hiện. Mẫu tách đôi không làm thẻ điền chỗ trống.
- **Nhiễu lấy từ cả kho OpenJLPT tĩnh**, xáo theo hạt giống, không lấy 300 mục đầu: tài khoản mới vẫn có thẻ điền
  chỗ trống, và nhiễu đổi mỗi lần.
- **Hạt giống theo số lần ôn** của mục, không theo ngày: gặp lại là câu khác (nếu có) và thứ tự khác.
- **Chấm**: đúng là Nhớ, sai là Quên như hôm nay; thêm nút nhỏ "Đoán" hiện sau khi chọn đúng, bấm thì ghi Khó thay vì
  Nhớ. Lịch vẫn chỉ đi qua `recordReviews()`.
- **Câu sai gặp lại cuối buổi**: một vòng "Làm lại câu sai" để tập, không chấm thêm (lịch đã ghi Quên).

### Nhiều câu cho một mục

Nguồn câu theo thứ tự: câu trong thẻ giải thích (AI viết), câu OpenJLPT, và **câu trong kịch bản Kaiwa** của chính người
học có chứa mục đó (đã có tách từ và tiếng Việt từ K4). Xoay theo số lần ôn. Thêm tool MCP `example_add` để AI của người
học thêm câu (có dịch) vào thẻ giải thích của một mục khi người học muốn; server kiểm câu có chứa mục.

## Các PR

| #   | PR                                                                                               | Xong khi                                  | Rủi ro                 |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------- |
| C1  | `examples.json`: script soạn, 50 câu mẫu cho thien xem, rồi cả bộ; test dữ liệu                  | thien duyệt mẫu, test xanh                | low (dữ liệu chưa nối) |
| C2  | Dựng thẻ từ `examples.json`: span, furigana, câu dịch, ngữ pháp luôn có câu (logic thuần + test) | test trên toàn kho: ngữ pháp có câu > 95% | high (hành vi học)     |
| C3  | Nhiễu cùng dạng từ kho tĩnh, hạt giống theo lần ôn, nút "Đoán", làm lại câu sai cuối buổi        | test + e2e                                | high                   |
| C4  | Giao diện thẻ: thẻ giới thiệu cho mục mới, khung đáp án mới, theo UI 7.4                         | ảnh trước/sau 1440 và 390, thien duyệt    | high                   |
| C5  | Nhiều câu: câu từ Kaiwa, xoay vòng, MCP `example_add`                                            | test, thử trong claude.ai                 | high                   |

Mỗi PR một mục đích, dưới khoảng 400 dòng code (file dữ liệu không tính). C2 và C3 độc lập sau C1.

## Giữ luật

- Web không soạn câu, không chấm tự do; dữ liệu câu là file tĩnh, chấm là so lựa chọn.
- Không đổi schema. Thẻ giải thích (`Item.enrichment`) đã có chỗ cho nhiều câu; `example_add` ghi vào đó qua
  `userDb(userId)`.
- FSRS chỉ qua `recordReviews()`.

## Câu hỏi cho thien

1. Ai dịch 7.700 câu ví dụ? Đề xuất: Claude soạn theo lô trong các phiên, thien xem 50 câu mẫu trước. (Cách khác:
   Gemma trên ubuntu-pc như lúc dịch nghĩa từ, nhanh hơn nhưng lần trước sai Hán Việt khoảng 1/10.)
2. Mục mới là **thẻ giới thiệu không chấm** (đề xuất), hay giữ thẻ lật bốn nút như hôm nay?
3. Nút **"Đoán"** sau khi chọn đúng: thêm (đề xuất), hay để đơn giản, đúng luôn là Nhớ?
