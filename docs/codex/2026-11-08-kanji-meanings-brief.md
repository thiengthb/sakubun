# Việc cho Codex: nghĩa tiếng Việt của 2.136 chữ kanji (KJ1b)

Kế hoạch gốc: `docs/plans/2026-11-08-kanji.md` (thien duyệt 2026-11-08). thien đã duyệt 50 nghĩa mẫu trong
`data/kanji/sample-review.md` và giao phần còn lại cho Codex. Bản này đủ để làm mà không cần đọc phần còn lại của repo.

## Mục tiêu

`data/kanji/kanji.json` có 2.136 chữ Jōyō, mỗi chữ có âm Hán Việt, âm On/Kun và nghĩa tiếng Anh (KANJIDIC2), nhưng
chưa có nghĩa tiếng Việt. Thẻ kanji trong app hiện nghĩa đó ngay dưới âm Hán Việt:

> 経 · KINH · đi qua; trải qua; kinh sách

Kết quả nằm trong `data/kanji/meanings-vi.json`, dạng `{ "chữ": "nghĩa" }`. Không sửa file nào khác ngoài file này.

## Cách làm, từng lô

Cần Node 22 trở lên. Chạy ở thư mục gốc repo, không cần `npm install` cho các script này.

1. Lấy lô tiếp theo (mặc định 200 chữ chưa làm, cấp dễ trước, chữ hay gặp trước):
   `node scripts/kanji/meanings-todo.ts --count 200 > /tmp/todo.json`
   Mỗi chữ có `hanviet`, `meaningEn`, `on`, `kun` và tối đa ba từ OpenJLPT chứa chữ đó, kèm nghĩa tiếng Việt của
   từ (`words`). Các từ này là chỗ dựa tốt nhất: nghĩa của chữ phải khớp với nghĩa nó mang trong các từ đó.
2. Viết kết quả ra một file **ngoài repo**, ví dụ `/tmp/batch.json`:

   ```json
   { "一": "một; thứ nhất", "国": "nước, quốc gia" }
   ```

3. Gộp vào (script kiểm từng chữ; có lỗi thì không ghi gì và in lỗi ra; sửa rồi chạy lại):
   `node scripts/kanji/meanings-merge.ts /tmp/batch.json`
4. Lặp lại. Không sửa tay `meanings-vi.json`: luôn đi qua `meanings-merge.ts` (nó giữ thứ tự và mỗi chữ một dòng).
5. Kiểm cả file: `node scripts/kanji/meanings-check.ts`. CI chạy cùng phép kiểm trong `lib/kanji/meanings.test.ts`.

Mỗi PR khoảng 500 chữ (hai hoặc ba lô), nhánh `data/kanji-meanings-<số>` từ `main`, tiêu đề
`data(kanji): Vietnamese meanings <từ>-<đến>`, nhãn `risk:low`. Không cần trang duyệt trong các PR này.

## Luật viết nghĩa

Theo đúng cách của 50 chữ mẫu đã duyệt (đọc `data/kanji/sample-review.md` trước khi bắt đầu):

- **Ngắn**: một đến ba nghĩa, ngăn bằng `; ` (chấm phẩy và một khoảng trắng). Tối đa 60 ký tự. Không chấm câu ở cuối.
- **Nghĩa của chữ, không phải của một từ**: 深 là "sâu; đậm", không phải "sâu sắc" của riêng 深い. Nghĩa hay gặp nhất
  đứng đầu.
- **Dựa vào Hán Việt và từ ví dụ**: nghĩa phải giải thích được vì sao chữ có mặt trong các từ ở `words`. Khi nghĩa
  tiếng Anh của KANJIDIC2 lạ hoặc cổ (致 "doth"), bỏ qua nó và theo nghĩa trong các từ.
- **Chữ Nhật chỉ trong ngoặc**, khi cần một từ để chỉ rõ nghĩa: 弁 là "nói năng; cơm hộp (弁当); van", 駄 là
  "hàng chở trên ngựa; vô ích (無駄)". Không dùng ngoặc cho việc khác.
- **Chữ thường**, trừ tên riêng (Nhật Bản). Không lặp lại âm Hán Việt làm nghĩa, trừ khi âm đó chính là từ tiếng Việt
  thường dùng và không có cách nói nào rõ hơn ("thuế" cho 税 được; "chính" cho 政 thì không, viết "chính trị; cai trị").
- **Đơn vị đếm** ghi "đếm ..." (羽: "lông vũ; cánh; đếm chim").
- Không dùng tiếng Anh, không giải thích dài, không ví dụ câu.

Ví dụ từ mẫu đã duyệt:

| Chữ | Hán Việt | Nghĩa                     |
| --- | -------- | ------------------------- |
| 日  | NHẬT     | mặt trời; ngày; Nhật Bản  |
| 楽  | LẠC      | vui; thoải mái; âm nhạc   |
| 寄  | KÝ       | ghé vào; gửi nhờ; lại gần |
| 種  | CHỦNG    | loại; giống; hạt giống    |
| 照  | CHIẾU    | chiếu sáng; đối chiếu     |
| 桟  | SẠN      | giàn giáo; cầu tàu (桟橋) |
| 憬  | CẢNH     | khao khát (憧憬)          |

## Kiểm trước khi mở PR

- `node scripts/kanji/meanings-check.ts` báo 0 lỗi.
- `npx vitest run lib/kanji` xanh (cần `npm ci` một lần).
- `git diff --stat` chỉ có `data/kanji/meanings-vi.json`.
- Đọc lại 20 chữ ngẫu nhiên trong lô: nghĩa có khớp với từ ví dụ không, có chữ nào bị dịch theo nghĩa tiếng Anh cổ
  không.
