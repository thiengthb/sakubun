---
id: L0003
title: Agent đoán một con số thuộc về thứ ĐANG CHẠY, rồi sửa theo con số đoán
scope: universal
class: verification
representation: verification-skill
status: active
owner: "@ai"
added: 2026-08-12
expires-review: 2027-02-12
occurrences: 4
evidence:
  - "sakubun 2026-07: `errorDigest` — đoán hình dạng chuỗi lỗi Prisma (đầu chuỗi, rồi 'đoạn cách bằng dòng trống'), e2e đỏ hai lần trước khi đọc chuỗi thật."
  - "sakubun 2026-08-11: điểm không hiện trên UI — đoán rằng log production không có lỗi nghĩa là app lành. Thật ra `score` là `.optional()` ở biên MCP (xem [[0004-prose-doi-truong-ma-schema-cho-phep-thieu]])."
  - "sakubun 2026-08-11: đoán ô tiêu đề bảng mất '~40px cho tay kéo + nút sắp xếp', đặt cột 64px → tiêu đề bị cắt thành 'C.', TỆ HƠN trước khi sửa. Đo ra: đúng 48px."
  - "sakubun 2026-08-11: mở issue #30 gọi một lỗi là lỗi production, kèm giả thuyết selective hydration của React. Hôm sau đo lại: tab đang `visibilityState: hidden` nên Chrome không render. Không có lỗi production nào."
artifacts:
  - "e2e/resources-tables.spec.ts (phép đo dùng-một-lần đã thành lưới thường trú: cộng scrollWidth-clientWidth, và bắt mọi th có span.truncate bị cắt)"
  - "e2e/no-js-first-paint.spec.ts (tải trang với JS tắt = đúng bằng HTML server, không phải xấp xỉ của nó)"
  - "lib/time-zone-pinned.test.ts (đo trước khi tin: đổi process.env.TZ giữa tiến trình KHÔNG có tác dụng, nên test viết theo cách hiển nhiên sẽ xanh cả khi bug còn nguyên)"
evals:
  - "evals/tasks/0005-do-truoc-khi-sua-be-rong.md"
exit-condition: >
  Không có, và đây là loại bài học không mong hết cần: nó không phải về một API,
  nó là về việc phân biệt "tôi biết" với "tôi đã đo". Xoá khi nào model không còn
  sinh ra con số nào mà nó không đọc được từ hệ thống đang chạy.
---

## Triệu chứng

Agent cần một con số là **thuộc tính của hệ thống đang chạy** — bề rộng đã render, chuỗi lỗi thật của
một thư viện, hàng thật trong DB, ngân sách đệm của một ô tiêu đề — và nó viết ra một con số *hợp lý*
thay vì đọc con số *thật*. Code chạy, test xanh ở chỗ khác, và bản sửa **hoặc không có tác dụng, hoặc
làm tệ hơn**.

Dấu hiệu sớm nhất nằm ngay trong văn bản agent đang viết: **"chắc là"**, **"khoảng"**, **"~"**. Ba chữ
đó là chỗ con số được bịa ra. Trong ca thứ ba ở trên, comment có đúng chữ "chắc mất ~40px" — con số sai
40 thay vì 48 làm tiêu đề "Cấp" bị cắt thành "C.".

Biến thể nguy hiểm hơn, và nó là ca thứ tư: agent **có** đo, và vẫn sai, vì phép đo có một **biến ẩn
không được ghi lại**. Poll 10 giây thấy 0/6 dropdown được điền là một quan sát đúng; kết luận "lỗi
production" là sai, vì tab đang bị Chrome treo việc render. Ba giả thuyết bị loại trong lần đó đều được
loại đúng — thứ không ai nghĩ tới là **cái kính đang soi**.

## Nguyên nhân

Model sinh văn bản khớp phân phối. Một con số hợp lý và một con số đúng **trông giống nhau** trong văn
bản, nên không có áp lực nội tại nào buộc phải đi đọc. Vòng lặp sửa-đoán-đỏ lại rẻ về mặt cảm giác (mỗi
lần chỉ một dòng), nên nó tự nuôi mình: đúng lúc cần dừng lại đi đo thì lại thấy "sửa nốt cái này là
xong".

Ca thứ tư có nguyên nhân riêng, và nó không phải sự lười: `visibilityState` không xuất hiện trong câu
hỏi ban đầu, nên nó không xuất hiện trong dữ liệu. Một phép đo chỉ trung thực bằng số biến nó khai.

## Cơ chế

Một luật, cụ thể hơn "hãy đo":

> Khi con số cần biết là thuộc tính của thứ **ĐANG CHẠY**, viết một phép đo **dùng-một-lần TRƯỚC** khi
> sửa. Và in **trạng thái môi trường đo** cùng lúc với dữ liệu, trong cùng một object.

Ba thứ làm nó khả thi thay vì chỉ là lời khuyên tốt:

1. **Phép đo phải rẻ hơn vòng lặp đoán.** Ở repo web: một spec Playwright tạm + `page.evaluate` trả về
   số, chạy 30 giây. Nếu đo đắt hơn đoán thì luật này sẽ bị bỏ, nên *làm cho đo rẻ* là phần việc thật.
2. **Phép đo tốt thì THÀNH lưới thường trú.** Con số đo một lần sẽ mục; phép đo thì không. Ca thứ ba
   biến thành một e2e cộng `scrollWidth - clientWidth` và bắt mọi tiêu đề bị cắt — nên câu hỏi "bảng có
   vừa không" không bao giờ phải hỏi lại bằng mắt.
3. **Khai biến môi trường trong cùng một output.** Với browser automation, ba biến đó là
   `visibilityState`, `hasFocus()`, kích thước viewport. Chúng rẻ đến mức không có cớ để thiếu.

Và một phản xạ: **triệu chứng chỉ xuất hiện dưới công cụ tự động mà "người thật bấm thì được" → nghi
công cụ trước, đừng nghi framework.** Nghi framework sinh ra một giả thuyết nghe rất kỹ thuật (lần đó là
selective hydration của React, viết ra hẳn một bảng); nghi công cụ kiểm bằng một dòng.

Vì sao là `verification-skill` chứ không phải `test`: không test được "agent đã đo chưa" một cách tổng
quát. Nhưng test được **hệ quả** ở từng ca — và đó là điều eval kèm theo làm: nó giao một task mà chỉ
con số ĐO ĐƯỢC mới đi qua được lưới e2e sẵn có.

## Chuyển đi được không

`universal`. Không phụ thuộc ngôn ngữ hay stack — "bề rộng đã render" chỉ là ca web của một họ rộng hơn:
độ trễ thật của một endpoint, kích thước thật của một payload, tên cột thật trong một bảng, định dạng
thật của một chuỗi lỗi. Mọi repo đều có họ đó.

Liên quan: [[0004-prose-doi-truong-ma-schema-cho-phep-thieu]] — ca thứ hai ở trên là cùng một lỗi nhìn
từ hai phía: agent đoán rằng "log không lỗi" nghĩa là "app lành", trong khi lỗi nằm ở một trường mà
schema cho phép thiếu.
