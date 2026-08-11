---
id: L0004
title: Trường mà tài liệu gọi là bắt buộc nhưng schema để optional sẽ bị model bỏ đi
scope: universal
class: verification
representation: test
status: active
owner: "@ai"
added: 2026-08-12
expires-review: 2027-02-12
occurrences: 3
evidence:
  - "sakubun 2026-08-11: `prompts.ts` bắt Claude gọi `submit_review` với `score` ở CẢ BA mode; schema là `z.number().optional()`. Khi thiếu, điểm mất ở HAI nơi cùng lúc: khối chép nguyên văn bỏ dòng '**Điểm:**', và thẻ trên trang chủ để lại một ô TRỐNG. Người học báo 'app không chấm điểm' nhiều lần từ bản sakubun cũ."
  - "sakubun: một unit test ĐANG KHOÁ hành vi im lặng đó (`.not.toContain('**Điểm:**')`) — xanh suốt nhiều tháng, tên mô tả đúng, nội dung bảo vệ con bug."
  - "sakubun 2026-08-12: cùng lớp lỗi ở tầng hiển thị — 6 dropdown `/settings` in ra span RỖNG ở HTML server, vì nhãn được tra từ registry chỉ tồn tại ở client."
artifacts:
  - "lib/mcp/tools/practice.ts (score là REQUIRED; từ chối ở biên thì không ghi gì, câu còn PENDING, chấm lại là đủ)"
  - "lib/score-label.ts + lib/score-label.test.ts (hàm thuần trả nhãn cho MỌI trạng thái, kể cả score=0)"
  - "lib/chart-empty.ts + lib/chart-empty.test.ts (cùng khuôn, cho biểu đồ không có gì để vẽ)"
  - "e2e/no-js-first-paint.spec.ts (tải với JS tắt: mọi ô giá trị trong HTML server phải có chữ)"
evals:
  - "evals/tasks/0005-do-truoc-khi-sua-be-rong.md"
exit-condition: >
  Xoá khi biên nhận dữ liệu từ model không còn tự viết schema bằng tay — ví dụ schema
  được SINH từ cùng một nguồn với prompt, nên hai bên không thể lệch nhau.
---

## Triệu chứng

Tài liệu (prompt, README, docstring) nói một trường là bắt buộc. Schema nói `optional`. Model đọc cả hai
và **lấp khoảng cách bằng cách bỏ trường đó đi** — thỉnh thoảng, không phải luôn, nên nó không bao giờ
xuất hiện trong một lần test tay.

Ở hạ nguồn, thiếu trường **không** thành lỗi. Nó thành một **ô trống**. Người dùng đọc ô trống đó là "app
hỏng", và không có cách nào phân biệt nó với lỗi thật. Log server im lặng (lời gọi thành công, HTTP 200),
nên mọi phép chốt đều xanh trong khi tính năng chính không hoạt động.

## Nguyên nhân

Hai lớp, và phải sửa cả hai — sửa một lớp thì lỗi chỉ đổi hình dạng:

1. **Biên quá dễ dãi.** `optional` trên một trường bắt buộc là một lời mời hỏng-im-lặng. Prose không
   cưỡng chế được gì; schema thì có.
2. **Ô trống được coi là trạng thái hiển thị hợp lệ.** Một nhánh render kiểu
   `typeof x === 'number' && (...)` không có `else` là một ô trống CÓ CHỦ Ý — và ô trống không giải thích
   được thì người dùng đọc thành "hỏng".

## Cơ chế

**Ở biên:** trường bắt buộc thì để bắt buộc. Từ chối ở biên là an toàn, ghi nửa vời mới không — lời gọi
thiếu bị chặn, không ghi gì, bản ghi giữ nguyên trạng thái cũ, nên model gọi lại là đủ.

Nhưng **đo xem lời từ chối có được ĐẾM không.** SDK MCP kiểm tham số **trước** handler, nên lời gọi bị
chặn không đi qua lớp guard và **không** vào bảng đếm tool. Đo được bằng một dấu hiệu rẻ: chỉ có **một**
dòng log cho **hai** lời gọi. (Tôi đã viết ngược điều này vào comment rồi phải sửa lại — xem
[[0003-do-truoc-khi-sua-va-ghi-lai-moi-truong-do]].)

**Ở tầng hiển thị:** một **hàm thuần** trả nhãn cho **mọi** trạng thái, đặt ở thư mục mà test runner
nhìn thấy. Ở repo này `vitest.config.ts` chỉ include `lib/**`, nên `lib/score-label.ts` test được không
cần trình duyệt, kể cả khi repo không có React Testing Library. Bắt buộc có ca `0`: `score && ...` biến
0 thành rỗng, và 0 là điểm hợp lệ.

**Và đọc lại các test có chữ "omits" / "không hiện" trong tên.** Hỏi mỗi cái: nó đang bảo vệ *hợp đồng*
hay đang bảo vệ *sự im lặng*? Ở ca trên, câu trả lời là cái thứ hai, và test đó phải bị đảo chiều.

## Chuyển đi được không

`universal`, và nó đang rộng ra chứ không hẹp đi: mọi biên nhận dữ liệu do model sinh (tool call, function
calling, structured output, webhook từ một service khác) đều có đúng cặp "tài liệu nói bắt buộc / schema
nói optional". Phần hiển thị thì đúng ở mọi UI: **ô trống không phải trạng thái hiển thị hợp lệ** — nó
phải nói được "chưa có" khác với "không áp dụng" khác với "đang chờ".

Cách rà một lần, rẻ: grep `optional` trong schema, đối chiếu với danh sách trường mà prompt/tài liệu đòi.
Mỗi chỗ lệch là một ứng viên của lỗi này.
