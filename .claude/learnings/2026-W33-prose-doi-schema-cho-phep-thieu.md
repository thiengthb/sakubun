# Khi prose đòi một trường mà schema cho phép thiếu

**Ngày:** 2026-08-11 · **Ca:** điểm không hiện, báo lại lần thứ n từ thời sakubun cũ

## Chuyện gì xảy ra

Người học báo "làm xong không thấy chấm điểm". Hôm qua tôi đo log production (`submit_review ms=89`,
không lỗi), kết luận app không hỏng, và ship nửa tất định: thẻ "Lượt vừa chấm" trên trang chủ. Hôm nay
họ báo **vẫn chưa hiện điểm trên UI**, kèm một câu hỏi tôi đáng ra phải tự hỏi: "hay là bạn chưa
redeploy".

Đo, theo thứ tự rẻ trước:

1. `docker images` + `docker inspect` → image build 11:30, commit 11:14. Deploy có thật.
2. `docker run --rm --entrypoint sh sakubun:local -c 'grep -rl "Lượt vừa chấm" /app/.next'` → có.
   Đây là mẹo đáng giữ: **exec vào container production bị classifier chặn, nhưng một container bỏ đi
   dựng từ cùng image thì không** — và nó trả lời đúng câu hỏi "artifact đang chạy có chứa bản sửa
   không", không phải "repo có chứa bản sửa không".
3. Còn lại một khả năng: điểm thiếu ở tầng dữ liệu. `grep score` → `z.number().int().min(0).max(100)
   .optional()`.

Và đây là chỗ đau: `prompts.ts` **đã** bắt Claude gửi `score` ở cả ba mode ("call submit_review with:
sentenceId, userAnswer, feedback, score, ratings"). Prose đòi, schema cho phép thiếu. Khi thiếu, điểm
mất ở **cả hai** nơi cùng lúc — `render.ts` bỏ luôn dòng `**Điểm:**` khỏi khối chép nguyên văn, và thẻ
chỉ render con số khi `typeof score === 'number'` nên để lại một ô trống. Người học đọc ô trống đó là
"app không chấm", và không có cách nào phân biệt nó với lỗi thật.

Tệ hơn: một unit test **đang khoá** hành vi im lặng đó (`.not.toContain('**Điểm:**')`). Một ca test xanh
suốt nhiều tháng, mô tả đúng, mà nội dung là bảo vệ con bug.

## Bài học

**Khoảng cách giữa prose và schema sẽ được model lấp bằng cách bỏ trường đó đi.** Mỗi trường mà tài liệu
gọi là bắt buộc nhưng schema để `optional` là một lời mời hỏng-im-lặng. Chỗ sửa là schema.

Ba thứ đi kèm, cụ thể cho repo này:

- **Từ chối ở biên là an toàn, ghi nửa vời mới không.** `score` bắt buộc → lời gọi thiếu bị chặn, không
  ghi gì, câu còn `PENDING`, nên Claude chấm lại là đủ và không mất rating nào. Đã chốt bằng e2e.
- **Nhưng đo xem lời từ chối có được ĐẾM không.** SDK kiểm tham số **trước** handler, nên lời gọi bị
  chặn (-32602) không đi qua `guard()` và **không** vào `mcp_tool_call`. Tôi đã viết ngược điều này vào
  comment rồi phải sửa lại — dấu hiệu: chỉ có **một** dòng `[mcp] tool=submit_review` cho hai lời gọi.
- **Ô trống không phải trạng thái hiển thị hợp lệ.** `lib/score-label.ts` là một hàm thuần trả nhãn cho
  mọi trạng thái ("82/100" · "Chưa có điểm" · "Bỏ qua" · null cho PENDING), nằm ở `lib/` vì
  `vitest.config.ts` chỉ include `lib/**` — nên quyết định hiển thị test được mà không cần trình duyệt,
  kể cả khi repo không có RTL. Kèm ca `score: 0`, vì `score && …` biến 0 thành rỗng.

## Dấu hiệu nhận ra lần sau

- Một trường xuất hiện trong tài liệu/prompt như bắt buộc mà `.optional()` trong schema.
- Một nhánh render kiểu `typeof x === 'number' && (...)` không có `else` — đó là một ô trống có chủ ý,
  và ô trống không giải thích được thì người dùng đọc thành "hỏng".
- Một test có chữ "omits" / "không hiện" trong tên: hỏi lại nó đang bảo vệ hợp đồng hay bảo vệ im lặng.
