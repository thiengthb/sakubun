# Phòng lab học tập — quy trình đi hết MỘT BUỔI, không phải một lượt

> Chủ: `@thi3n` · thêm 2026-08-12 · xem lại: 2026-11-12
> Vì sao có file này: **mười** lỗi được tìm ra trong đúng một buổi chạy quy trình dưới đây, và **không
> lỗi nào trong số đó bị bất kỳ unit test hay e2e nào bắt được** — vì không lượt nào tự sai. Chúng chỉ
> hiện ra khi đi liên tiếp nhiều lượt trên MỘT tài khoản. Danh sách đầy đủ:
> `docs/progress/learning-loop-lab.md`.

## Vấn đề mà quy trình này giải

Lưới hiện có kiểm hai tầng, và bỏ trống tầng thứ ba:

| Tầng | Ai gác | Bắt được gì |
|---|---|---|
| Hàm | `lib/practice.test.ts` | FSRS tính đúng, rating hạ đúng, hàm thuần đúng |
| Một lượt | `e2e/mcp-practice-loops.spec.ts` | một lượt thật đi hết `get_due_items → stage → submit` và nằm lại DB |
| **Một buổi** | **không ai** | hạn mức ngày chạm đáy ở câu thứ mấy · lô rỗng thì lời khuyên có đúng · chỉ tiêu ngày có đóng được · đổi dịch ↔ quiz giữa buổi thì cài đặt còn nghĩa gì |

Tầng thứ ba không test tự động được một cách tổng quát: phần lớn nó là **chất lượng chỉ dẫn** —
sheet có tự mâu thuẫn không, lời khuyên khi bí có đúng không. Nhưng nó ĐO được, bằng cách đi thật.
Và mỗi lần đi thật tìm ra một lỗi, lỗi đó phải trở thành một phép kiểm tất định (xem "Luật đóng vòng").

## Chạy

```
node tooling/learning-lab.mjs --fresh      # DB mới + tài khoản mới
node tooling/lab-mcp.mjs --list
node tooling/lab-mcp.mjs get_settings '{}'
```

Lab ở cổng **3801** — không phải 3789 (dev/container thật) hay 3799 (e2e). DB nằm trong
`os.tmpdir()/sakubun-learning-lab/`, ngoài repo.

**Next 16 từ chối hai dev server cùng một thư mục.** Nên lab và `npx playwright test` không chạy song
song được: dừng lab trước khi chạy e2e. (Mất 30 giây mới hiểu ra điều này lần đầu.)

Muốn xem UI đổi theo từng lượt: mở `http://localhost:3801` và đăng nhập bằng cặp mà script in ra.

## Đi một buổi

Đóng cả hai vai. Vai Claude Desktop thì làm **đúng** những gì `lib/mcp/prompts.ts` bắt làm — không
tắt bước nào, vì mỗi bước bị tắt là một vùng không được đo. Vai người học thì trả lời như người thật:
đúng, sai, né mất mẫu, hỏi ngang, bỏ qua.

1. `get_settings` + `get_stats` — đọc khối "Tiến độ".
2. Chọn trọng tâm từ menu (Ngẫu nhiên / một cấp / một mẫu / điểm yếu).
3. Mỗi câu: `get_due_items` → soạn câu THẬT → `stage_sentence` (kèm `extraPatterns`) → trả lời →
   `submit_review` (kèm `errorTags` khi rating ≤ 2).
4. **Đi cho tới khi HẾT.** Đây là phần quan trọng nhất và là phần dễ bỏ nhất: bốn trong sáu lỗi hôm
   nay nằm ở câu thứ 4 trở đi, sau khi hạn mức ngày chạm đáy.
5. Đổi sang quiz giữa buổi (`get_quiz_items`), rồi thử `skip_sentence`.

Nội dung câu phải chuẩn thật — đúng cấp, đúng cách gắn, đúng văn phong. Câu bịa cho xong sẽ đo ra
một app khác với app người học dùng.

## Luật đóng vòng

Một lỗi tìm được ở đây **chưa xong** khi đã sửa code. Nó xong khi có một phép kiểm tất định giữ chỗ,
theo thứ tự rẻ dần của `.claude/rules/README.md`: `test > generator > lint/hook > … > RULE`.

Mười lỗi của buổi 2026-08-12 và chỗ mỗi lỗi được ghim lại:

| Lỗi | Ghim ở |
|---|---|
| Sheet đòi "weave in 3" trong khi lô chỉ có 1 mẫu | `lib/mcp/render.test.ts` — 3 ca, cả hai chiều |
| Hết hạn mức mẫu mới → khuyên "mở rộng cấp / nhập thêm ngữ pháp" trong khi còn 9 mẫu cùng cấp | `lib/mcp/render.test.ts` — ca phủ định |
| "đã sạch hàng đợi" in cạnh "câu 2/10" | `lib/mcp/render.test.ts` — 2 ca |
| Khối mở buổi không hề nói chỉ tiêu ngày | `lib/mcp/render.test.ts` |
| Vòng quiz không đếm `dailyNewGrammar` | `lib/practice.ts` + mô tả tool |
| Chấm quiz theo chữ cái SAI mà không ai đối chiếu | `lib/quiz-options.test.ts` — 10 ca, + chặn ở `submitReview` |
| `check_library` đề xuất `add_grammar` cho một TỪ, và lá chắn đồng thuận không phủ tool sẽ ghi thật | `lib/coach.test.ts` · `lib/mcp/render.test.ts` |
| Bảng hợp đồng tham số lệch 5 chỗ, và không phủ nhóm `sweep` | `lib/coach.test.ts` — dựng lại từ `tools/list`, sàn độ phủ 6 → 11 |
| `RAISE_NEW_CAP` điền `null` vào chỗ server đòi số | `lib/coach.test.ts` — kiểm cả GIÁ TRỊ, không chỉ khoá |
| Lượt HỘI THOẠI bị gán nhãn dịch (lần thứ BA của lớp lỗi này) | `lib/mcp/render.test.ts` — đi qua MỌI giá trị của `EXERCISE_TYPE` |

Lỗi thứ sáu là ví dụ tốt nhất cho luật này: nó bắt đầu là **lỗi của chính tôi khi đóng vai** (tôi ghi
"chọn A" trong khi server xếp đáp án ở D), và trở thành một phép kiểm chặn được cả lớp lỗi đó mãi mãi.
Người đóng vai sai chỗ nào thì Claude thật cũng sai chỗ đó.

Và lỗi thứ mười dạy thêm một điều: **sửa cùng một lớp lỗi lần thứ ba thì đừng sửa ca đó nữa — sửa cái
làm cho nó bị bỏ sót.** Ba lần trước đều thêm một cờ `isX`; cái cờ phải NHỚ, cái bảng phải ĐIỀN. Nếu bạn
đang viết `isX` thứ ba, đó là tín hiệu.

## Cái quy trình này KHÔNG đo

- **Safari thật.** WebKit của Playwright không đăng nhập được ở môi trường local (đo 2026-08-12), nên
  mọi kết luận về iOS phải đến từ máy thật của người dùng, không từ đây.
- **VOICEVOX.** Engine chỉ chạy trong compose network, lab không với tới — `/api/tts` trả 503 và client
  rơi về Web Speech. Muốn đo đường TTS chính thì chặn route và trả một WAV hợp lệ, nếu không sẽ đo lẫn
  "engine chết" vào "client hỏng".
- **Chất lượng câu Claude thật soạn ra.** Ở đây tôi tự soạn, nên phép đo nói về TOOL và CHỈ DẪN, không
  nói về việc model thật có tuân theo hay không. Phần đó thuộc `evals/`.
