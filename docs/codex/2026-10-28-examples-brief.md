# Việc cho Codex: dịch câu ví dụ OpenJLPT (C1b)

Kế hoạch gốc: `docs/plans/2026-10-28-quick-review.md` (phần C, thien duyệt 2026-10-28). thien giao phần dịch cho
Codex. Bản này đủ để làm mà không cần đọc phần còn lại của repo.

## Mục tiêu

`data/openjlpt/source.json` có 7.771 mục (ngữ pháp và từ vựng) kèm **một câu ví dụ tiếng Nhật**, chỉ có bản dịch tiếng
Anh. Ôn nhanh cần cho mỗi câu:

- `vi`: câu dịch tiếng Việt tự nhiên;
- `span`: đúng đoạn chữ của mục trong câu, để app gạch chân hoặc đục lỗ;
- `formationVi` (chỉ ngữ pháp có `formation`): cách nối bằng tiếng Việt;
- `skip`: lý do, nếu câu không hợp để học.

Kết quả nằm trong `data/openjlpt/examples.json`. Không sửa file nào khác ngoài file này (và `examples-review.md` khi được
yêu cầu).

## Cách làm, từng lô

Cần Node 22 trở lên. Chạy ở thư mục gốc repo, không cần `npm install` cho các script này.

1. Lấy lô tiếp theo (mặc định 100 mục chưa làm):
   `node scripts/openjlpt/examples-todo.ts --count 100 > /tmp/todo.json`
2. Viết kết quả ra một file **ngoài repo**, ví dụ `/tmp/batch.json`, dạng object khoá theo `id`:

   ```json
   {
     "g:wa": {
       "vi": "Tôi là sinh viên.",
       "span": ["は"],
       "formationVi": "Danh từ + は"
     },
     "v:ada066edfd": { "vi": "Anh đã gặp anh Smith rồi nhỉ.", "span": ["会わ"] }
   }
   ```

3. Gộp vào `examples.json` (script kiểm từng mục, có lỗi thì không ghi gì và in lỗi ra; sửa rồi chạy lại):
   `node scripts/openjlpt/examples-merge.ts /tmp/batch.json`
4. Lặp lại. Không sửa tay `examples.json`: luôn đi qua `examples-merge.ts` (nó giữ thứ tự và mỗi mục một dòng).
5. Kiểm cả file: `node scripts/openjlpt/examples-check.ts`. CI chạy cùng phép kiểm trong
   `lib/import/examples-data.test.ts`.

### Bước đầu: 50 câu mẫu cho thien duyệt

Trước khi làm cả bộ:

1. `node scripts/openjlpt/examples-todo.ts --sample 50 > /tmp/todo.json` (rải đều hai loại và mọi cấp).
2. Làm 50 mục đó, gộp vào, rồi `node scripts/openjlpt/examples-check.ts --review` để ghi
   `data/openjlpt/examples-review.md`.
3. Mở một PR chỉ có `examples.json` và `examples-review.md`, tiêu đề
   `data(openjlpt): 50 sample example translations for review`. Dừng lại chờ thien duyệt. thien có thể sửa luật dịch
   bên dưới; làm theo bản đã sửa.

### Sau khi thien duyệt mẫu

Làm phần còn lại, mỗi PR khoảng 1.000 mục (10 lô), nhánh `data/openjlpt-examples-<số>` từ `main`, tiêu đề
`data(openjlpt): example translations <từ>-<đến>`. Không cần `examples-review.md` trong các PR này.

## Luật dịch `vi`

- Dịch **từ câu tiếng Nhật**, không dịch lại câu tiếng Anh. Câu tiếng Anh chỉ để đối chiếu; khi hai bên khác nhau,
  theo tiếng Nhật.
- Tiếng Việt tự nhiên, như người Việt nói, giữ đúng sắc thái: です/ます dịch trung tính lịch sự; thể thường dịch tự
  nhiên, thân mật nếu câu thân mật (`〜よ`, `〜ね`, `〜わ`); kính ngữ dịch bằng cách xưng hô kính trọng.
- Đại từ: `私` là "tôi"; người nói không rõ thì chọn cách xưng hô hợp ngữ cảnh. Tên người Nhật giữ phiên âm Latin
  (`田中さん` thành "anh/chị Tanaka"), tên nước ngoài viết theo tiếng Việt thường dùng (`スミスさん` thành "anh Smith").
- Phần mục đang học phải hiện rõ trong câu dịch: câu cho `〜より` phải có chữ "hơn".
- Không để lại chữ Nhật (kana, kanji) trong `vi`. Tối đa 300 ký tự. Một câu, không chú thích, không ngoặc giải thích.

## Luật `span`

`span` là danh sách mảnh. Mỗi mảnh là **đúng chữ trong câu** (tìm từ trái sang phải) hoặc cặp `[đầu, cuối]` (vị trí
theo đơn vị UTF-16 của JavaScript, `cuối` không tính) khi chữ đó xuất hiện hơn một lần.

- Lấy phần chữ của **chính mục đó** như nó xuất hiện trong câu, kể cả khi đã chia, nhưng **không** kèm trợ động từ
  hay trợ từ theo sau (ます, た, て, ない, れる, られる…) và không kèm danh từ hay động từ mà mẫu gắn vào.
- Mẫu tách đôi thì hai mảnh. Tên có hai dạng (`〜くて / 〜で`) thì chỉ lấy dạng có trong câu.
- Từ viết khác trong câu (`いす` mà câu viết `椅子`) vẫn lấy chữ trong câu.

| Mục | Câu | `span` |
| --- | --- | --- |
| `〜は` | 私は学生です。 | `["は"]` |
| `〜は` | 私はこれは好きです。 | `[[1, 2]]` (`は` xuất hiện hai lần) |
| `〜より` | 今日はきのうより寒いです。 | `["より"]` |
| `〜しか〜ない` | 財布に五百円しかない。 | `["しか", "ない"]` |
| `〜すぎる` | ゆうべ飲みすぎて、頭が痛い。 | `["すぎ"]` |
| `〜くて / 〜で` | この店は安くておいしいです。 | `["くて"]` |
| `〜たばかり` | 日本に来たばかりなので… | `["たばかり"]` |
| `明るい` | 外はだんだん明るくなっていく。 | `["明るく"]` |
| `会う` | もうスミスさんに会われましたね。 | `["会わ"]` |
| `多い` | この学校は男子よりも女子が多い。 | `["多い"]` |
| `いす` | ちょっと椅子をずらしてくれない？ | `["椅子"]` |

## Luật `formationVi`

Chỉ cho ngữ pháp có `formation`. Dịch các nhãn, giữ nguyên chữ Nhật và dấu `+`, `/`:

| Nhãn trong nguồn | Tiếng Việt |
| --- | --- |
| Noun | Danh từ |
| Verb-dict | Động từ thể từ điển |
| Verb-plain | Động từ thể thông thường |
| Verb-stem | Động từ bỏ ます |
| Verb-te | Động từ thể て |
| Verb-ta | Động từ thể た |
| Verb-nai | Động từ thể ない |
| Verb-nai stem | Động từ thể ない bỏ ない |
| Verb-volitional | Động từ thể ý chí |
| Verb-ba | Động từ thể ば |
| i-Adj | Tính từ い |
| i-Adj stem | Tính từ い bỏ い |
| i-Adj-ku | Tính từ い đổi い thành く |
| na-Adj | Tính từ な |
| Sentence | Câu |
| Question word | Từ để hỏi |

Nhãn khác thì dịch cùng kiểu, ngắn gọn.

## Luật `skip`

Đặt `skip` (một câu lý do ngắn, tiếng Việt) và bỏ `vi`, `span`, `formationVi` khi câu không hợp để học:

- thô tục, tình dục, xúc phạm;
- dùng mục theo nghĩa bóng hoặc nghĩa hiếm, khác hẳn nghĩa đang học (`お前はまだ「青い」な` cho `青い` "màu xanh");
- câu không chứa mục dưới dạng nào.

Không bỏ câu chỉ vì khó hay dài. Số câu bỏ nên dưới khoảng 5%.

## Kiểm trước khi mở PR

- `node scripts/openjlpt/examples-check.ts` báo 0 lỗi.
- `npx vitest run lib/import/examples-data.test.ts` xanh (cần `npm ci` một lần).
- `git diff --stat` chỉ có `data/openjlpt/examples.json` (và `examples-review.md` ở PR mẫu).
