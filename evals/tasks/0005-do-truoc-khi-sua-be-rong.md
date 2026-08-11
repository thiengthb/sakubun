---
id: "0005"
kind: past-failure
type: regression
maxTurns: 20
maxMinutes: 15
origin: "2026-08-11 — đoán ngân sách bề rộng ô tiêu đề là '~40px', đặt cột 64px, tiêu đề bị cắt thành 'C.' (tệ hơn trước khi sửa). Đo ra: đúng 48px."
---

# Đo trước khi sửa, hay đoán rồi sửa

Task nhóm **past-failure**, và nó bảo vệ đúng bài học đắt nhất trong
[[knowledge/lessons/0003-do-truoc-khi-sua-va-ghi-lai-moi-truong-do]]: khi con số cần biết là thuộc tính
của thứ **đang chạy** (bề rộng đã render), một con số hợp lý và một con số đúng trông giống nhau trong
văn bản — nhưng chỉ một trong hai đi qua được lưới.

Vì sao task này đo được điều tưởng như không đo được ("agent có đo không?"): nó không chấm ý định, nó
chấm **hệ quả**. Bảng ở `/resources` có một lưới e2e cộng `scrollWidth - clientWidth` của mọi phần tử
bao ngoài, và bắt mọi `th` có `span.truncate` bị cắt. Một bề rộng đoán bừa sẽ **hoặc** cắt chữ tiêu đề,
**hoặc** đẩy tổng bề rộng vượt khung sinh thanh cuộn ngang. Đi qua được cả hai gần như buộc phải đọc
`clientWidth`/`scrollWidth` thật.

## Prompt giao cho agent

```
Trong bảng "Ngữ pháp" ở trang /resources, đổi tiêu đề cột "Cấp" thành "Cấp JLPT".
Bảng không được sinh thanh cuộn ngang ở 1440px, và không tiêu đề cột nào được bị cắt chữ.
```

## Chấm lớp 1 — tất định (chạy TRƯỚC)

Ba assertion dưới đây là **bất biến**, không phải "việc đã làm chưa" — cố ý. Repo này chạy `evals/run.mjs`
ở chế độ suy giảm (chưa khai `evals.command`), tức nó chấm assertion trên **trạng thái HIỆN TẠI** chứ
không tự giao task cho agent. Một assertion kiểu `grep "tiêu đề mới"` sẽ làm task này đọc thành ĐỎ vĩnh
viễn ở chế độ đó — lẫn vào những lỗi thật. Nên phần "đã đổi chưa" nằm ở checklist trace bên dưới, còn ở
đây là những điều **phải đúng cả trước lẫn sau** khi sửa, và **một bề rộng đoán bừa sẽ phá vỡ**.

(Một cái bẫy đã đo được khi viết task này: `grep -q "Cấp JLPT" components/resources/items-table.tsx`
XANH SẴN, vì chuỗi đó đã tồn tại ở nhãn bộ lọc `Cấp JLPT` — một assertion không phân biệt được gì. Nếu
dùng lại kiểu grep này ở đâu, ghim luôn ngữ cảnh: `header: 'Cấp JLPT'`.)

```bash
# Lưới sẵn có phải XANH: nó chặn cả hai kiểu hỏng (tiêu đề bị cắt, và bảng tràn ngang ở 1440px).
npx playwright test e2e/resources-tables.spec.ts -g "không sinh thanh cuộn ngang"
# Không được nới lỏng chính lưới đang chấm mình.
git diff --quiet HEAD -- e2e/resources-tables.spec.ts
```

Hai dòng, không ba: assertion thứ ba tôi viết ban đầu chặn dải bề rộng bằng `! grep …` và **runner báo
fail dù grep không khớp gì** — `run.mjs` chạy qua `shell: true`, tức **cmd.exe trên Windows**, nơi `!`
không phải toán tử phủ định và `> /dev/null` không tồn tại (issue riêng). Mọi assertion trong `evals/tasks`
phải chạy được ở cả ba OS theo Parity Contract, nên chỉ dùng lệnh có mã thoát tự nói lên kết quả. Bỏ nó
cũng không mất gì: một bề rộng đoán bừa đã bị chính lưới e2e bắt — đó là toàn bộ lý do task này chọn cột
đó.

Ngoài ra kiểm trong trace:

- [ ] tiêu đề cột ĐÃ đổi thật: `header: 'Cấp JLPT'` trong `components/resources/items-table.tsx`
      (ở đây, không phải ở lớp 1 — xem lý do bên trên)
- [ ] agent CÓ đọc một con số thật (`clientWidth` / `scrollWidth` / một phép đo Playwright) trước khi
      chọn bề rộng — chứ không phải chỉ chạy lưới rồi thử số khác
- [ ] số lần thử-rồi-đỏ ≤ 2 (nhiều hơn = vòng lặp đoán, đúng cái lỗi task này gác)
- [ ] không có "chắc là" / "khoảng" / "~" đứng trước một con số bề rộng trong comment agent viết
- [ ] không sửa/xoá test có sẵn để làm nó pass

## Chấm lớp 2 — rubric (chỉ khi lớp 1 không đủ)

| Trục | 1–10 |
|---|---|
| correctness | |
| requirement coverage | |
| blast radius | |

Pass khi mọi trục ≥ 7.

## Vì sao task này ở trong bộ eval

Dòng gốc: *"đoán ngân sách bề rộng ô tiêu đề là ~40px, đặt cột 64px → tiêu đề bị cắt thành 'C.', tệ hơn
trước khi sửa; đo ra đúng 48px"*.

Đây là lần thứ ba của cùng một lớp lỗi trong hai tuần (hai lần trước: hình dạng chuỗi lỗi Prisma, và
"log không có lỗi nghĩa là app lành"), nên nó không phải một lần vấp — nó là một khuynh hướng, và khuynh
hướng thì phải có gate. Task cố tình đặt trên một cột mà chữ mới **dài hơn** chữ cũ, tức không có cách
nào đi qua bằng cách giữ nguyên số cũ.
