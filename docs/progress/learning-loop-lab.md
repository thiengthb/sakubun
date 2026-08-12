# Vòng lặp học tập — đi hết một buổi, và sáu lỗi rơi ra

**2026-08-12.** Dựng phòng lab (`tooling/learning-lab.mjs`), đóng cả hai vai — Claude Desktop gọi MCP
và người học trả lời — đi liên tiếp 8 lượt trên một tài khoản mới: 4 lượt dịch, 3 lượt quiz, một lượt
bị chặn. Quy trình ở `docs/LEARNING-LAB.md`.

**Điều đáng nói nhất: không lỗi nào dưới đây bị unit test hay e2e bắt được, và không lượt nào tự sai.**
Chúng là thuộc tính của một CHUỖI lượt. Lỗi 1 và 3 xuất hiện ngay từ câu đầu tiên của mọi người học mới
và đã ở đó suốt.

## Sáu lỗi

1. **Sheet soạn câu tự mâu thuẫn.** `weave in **3** grammar pattern(s)` lấy từ `sentenceSize`, in trên
   một danh sách có đúng **1** mẫu (hạn mức `maxNewPerSentence` giữ phần còn lại). Giao thức đồng thời
   nói "số mẫu dệt vào = đúng số item trong lô" và "KHÔNG bao giờ soạn quanh mẫu không có trong lô" —
   nên Claude nhận ba con số khác nhau cho một quyết định, ở đường nóng nhất của app. Đúng loại "chỉ thị
   xung đột" mà `.claude/rules/README.md` gọi là thứ làm model kém đi.
   → `lib/mcp/render.ts`: đếm theo lô, và nói ra vì sao lệch. 3 ca test, cả hai chiều.

2. **Hết hạn mức mẫu mới thì app khuyên sai.** Lô rỗng vì `dailyNewGrammar`, mà sheet lại bảo Claude
   mời người học **mở rộng cấp lên N4** hoặc **nhập thêm ngữ pháp ở cấp đang học** — trong khi còn
   **9 mẫu N5 chưa học** nằm sẵn. Cả hai lời mời đều vô ích; cách chữa đúng đã nằm ở dòng ngay bên
   cạnh (nâng hạn mức, hoặc chờ learning step).
   → chốt điều kiện `newAvailable.grammar === 0`. Ca phủ định trong lưới.

3. **Dòng người học đọc mỗi lượt tự đá nhau.** `câu **2/10** — đã sạch hàng đợi`: nửa đầu bảo còn 8 câu,
   nửa sau bảo hết việc, trong khi ba mẫu vừa học đang ở learning step cách 5-10 phút. `dueNow` chỉ biết
   về giây phút này.
   → ba trạng thái thay vì hai; thêm `nextDueAt` vào `SubmitReviewResult`. 2 ca test.

4. **Khối mở buổi không hề nói chỉ tiêu ngày.** Khối cuối lượt in `câu X/10`, khối MỞ buổi chỉ in
   `N lượt · M mẫu mới` — nên người học gặp chỉ tiêu lần đầu ở cuối lượt một, và hạn mức quyết định
   chỉ tiêu có khả thi hay không thì không xuất hiện ở đâu cả.
   → thêm `câu X/goal · mẫu mới N/cap` vào khối "Tiến độ".

5. **Vòng quiz không đếm hạn mức mẫu mới của ngày.** `get_due_items` tôn trọng `dailyNewGrammar`,
   `get_quiz_items` thì không: một lượt quiz ngay sau khi vòng dịch tiêu hết 3/3 đã nạp thêm mẫu thứ tư
   và bộ đếm ngày thành "4 mẫu mới" trên hạn mức 3. Người đặt nhịp chậm rồi làm 20 câu quiz sẽ bị đẩy
   20 mẫu mới vào FSRS bởi đúng cái cài đặt lẽ ra ngăn việc đó.
   → chốt hạn mức trong `getQuizBatch`, thêm `newCapReached` để Claude nói được lý do.

6. **Chấm quiz theo chữ cái SAI mà không ai đối chiếu.** Từ 2026-07-28 server tự xếp A–D nên **vị trí**
   đáp án không lệch được nữa; nửa còn lại vẫn hở: không gì kiểm rằng người chấm ĐỌC ĐÚNG vị trí đó.
   Lỗi này bắt đầu là lỗi của chính tôi khi đóng vai — server xếp đáp án ở **D**, tôi ghi "Chọn A" kèm
   mẫu ở D, và cả rating lẫn khối hiển thị đều được viết từ đó. Chữ cái lệch nghĩa là người học có thể
   bị nói là sai khi họ đúng, và một dòng FSRS được ghi từ đó.
   → `quizAnswerMismatch()` (thuần, 10 ca) + chặn trong `submitReview` kèm hướng dẫn tự chữa. Cố ý dè
   dặt: chỉ báo khi chỉ ra được chữ cái đúng, vì `userAnswer` là văn bản tự do do model viết.

Kèm theo: lượt quiz bị gán nhãn dịch (`Đề (Nhật → Việt)` / `Bạn dịch: Chọn C` / mời "gõ lại bản dịch"
khi câu trả lời là một chữ cái) — đúng lỗi đã sửa cho teach-back ngày 2026-07-27, sống sót vì chỉ
teach-back được đặt tên. → `QUIZ_EXERCISE` + `Câu hỏi` / `Bạn chọn` / `Đáp án`.

## Vòng hai — bốn lỗi nữa, ở các luồng chưa đi

Đi tiếp những luồng còn trống: hỏi ngang giữa buổi, từ vựng theo yêu cầu, hội thoại, giảng lại, bỏ qua.

7. **`check_library` đề xuất sai tool cho một TỪ.** Hỏi về 「台所」 (danh từ) thì app đề xuất
   `add_grammar` — nghĩa là một danh từ vào pool NGỮ PHÁP, chiếm slot mẫu trong mọi câu và tiêu
   `dailyNewGrammar`, đúng thứ mà `settings-schema.ts` hứa từ vựng không bao giờ được làm ("the
   anti-N5-drag guarantee"). Kèm hai lỗi nữa trong cùng một đề xuất: `args: { items: [...] }` không phải
   khoá của tool nào (`add_grammar` nhận `grammar`, `add_vocab` nhận `vocab`), và `renderConsentGuard`
   dựng danh sách "chưa được phép gọi" TỪ trường `tool` — nên gọi tên sai tool để lại đúng cái tool sẽ
   ghi thật (`add_vocab`) **không được lá chắn nào phủ**. Lá chắn vẫn in ra, vẫn trông yên tâm.
   → chọn tool theo `kind`; mặc định `add_vocab` khi không biết (đoán sai hướng này không phá ngân sách);
   thêm `alsoTool` để lá chắn phủ cả hai.

8. **Bảng hợp đồng tham số — dựng để bắt lỗi (7) — cũng sai, và vì thế hợp thức hoá nó.**
   `TOOL_ARGS` trong `lib/coach.test.ts` ghi `add_grammar: ['items']`. Đối chiếu với `tools/list` của
   server thật: lệch **năm** chỗ (`add_grammar`, `add_vocab` thiếu hẳn, `get_due_items` liệt kê 4 tham số
   không tồn tại, `update_settings` ghi `dailyReviewCap` thay vì `maxReviewsPerDay`, `update_vocab` ghi
   `hanviet` thay vì `sinoVietnamese`). Và nó không phủ nhóm `sweep` chút nào — 5 code không ai gác.
   → dựng lại bảng từ `tools/list`, phủ thêm `coachLibrary`, nâng sàn độ phủ 6 → 11 code.
   **Một hàng quá rộng tệ hơn một hàng thiếu: nó xanh trong im lặng.**

9. **`RAISE_NEW_CAP` mời một cái "vâng" không thực hiện được.** Đề xuất `blocker` ưu tiên cao nhất (85)
   điền sẵn `{ dailyNewGrammar: null }`; gọi thẳng vào server thì bị Zod chặn — "expected number". Người
   học đồng ý và nhận về một lỗi validation thay vì cài đặt họ vừa đồng ý.
   → đề xuất số thật (`hiện tại + 1`, chặn ở ngưỡng 20 của schema), và lưới giờ kiểm cả GIÁ TRỊ chứ
   không chỉ khoá — `null`/`undefined` trong `args` là đỏ.

10. **Lượt HỘI THOẠI bị gán nhãn dịch.** `Đề (Việt → Nhật):` cho một bối cảnh
    ("Bối cảnh: … Bạn cần: … Văn phong: …"), và `Bạn dịch:` cho một câu người học **tự nói ra**.
    Đây là lần thứ BA của cùng một lớp lỗi (teach-back 27/07, quiz sáng nay, hội thoại chiều nay), và cả
    ba lần trước đều được sửa bằng cách thêm một cờ `isX`. Đó chính là lý do có lần thứ ba: **một cái cờ
    thì phải NHỚ, một cái bảng thì phải ĐIỀN.**
    → `TURN_LABELS` theo `exerciseType`, và một phép kiểm đi qua **mọi** giá trị của `EXERCISE_TYPE`, nên
    một kiểu luyện mới tới sẽ phải chọn nhãn có ý thức thay vì thừa hưởng nhãn dịch trong im lặng.

Đã đi và ĐÚNG, không cần sửa: `skip_sentence` (lưu vào lịch sử, không tính FSRS), từ vựng theo yêu cầu
(`[VOCAB · NEW]` nằm ngoài số mẫu ngữ pháp, chấm riêng, có ngân sách riêng), `get_protocol` cho cả hai
kiểu luyện, `suggest_group` và `set_below_target_suspended` (tôi nghi tham số sai — kiểm ra là đúng).
`today.reviews` đếm 1 khi có 2 mục được chấm cũng là chủ ý: nó là ngân sách NGỮ PHÁP.

## Một phát hiện KHÔNG sửa được bằng code

**Cài đặt mặc định không đóng nổi chỉ tiêu ngày.** Đo trên tài khoản mới, mặc định nguyên bản
(`sessionGoal 10`, `dailyNewGrammar 3`, `maxNewPerSentence 1`):

- 3 mẫu mới → 3 câu (một mẫu mới mỗi câu)
- learning step trả về **gộp ba mẫu vào MỘT câu** → thêm ~2 câu
- MASTERY MODE không cứu được: `MASTERY_MIN_GRADUATED = 8`, tài khoản mới có 2 mẫu tốt nghiệp

→ ngày kịch trần khoảng **5/10**, rồi báo hết bài. Đây không phải bug: là hai cài đặt không đồng ý với
nhau, và việc chọn bên nào là quyết định HỌC TẬP của chủ tài khoản (hạ chỉ tiêu, hay nâng hạn mức mẫu
mới). Lỗi 4 làm mâu thuẫn đó hiện ra từ lượt số 0 thay vì để người học tự đụng phải ở câu thứ 5.

## Chưa đo được

- **Safari thật** — WebKit của Playwright không đăng nhập được ở local, nên mọi kết luận về iOS phải
  đến từ máy thật.
- **Chất lượng câu Claude thật soạn** — ở lab tôi tự soạn, nên phép đo nói về tool và chỉ dẫn, không
  nói model có tuân thủ hay không. Phần đó thuộc `evals/`.
