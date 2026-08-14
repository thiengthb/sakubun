# Learnings — tuần 33, claude

## Self-check của harness khẳng định thứ chỉ đúng khi nó chạy TRONG repo template

**Lần xuất hiện** (cần ≥2 — một lần là ngẫu nhiên):

- `fixlog` — `apply-to.mjs --audit` đòi mọi file phải nằm trong HARNESS/SEED, nhưng
  `doctor.mjs` và `harness-parity.yml` chạy nó ở **mọi project đích**: 351 file source của
  sakubun bị báo thiếu, doctor đỏ và CI parity fail mọi PR.
- `fixlog` — `test-hooks.mjs` hardcode `file_path: 'src/a.ts'`, nhưng sakubun dùng layout
  `app/ components/ lib/`. `npx eslint --fix src/a.ts` exit 2 ⇒ ca `lintFix chưa khai → bỏ qua`
  đỏ. Test sai chứ hook đúng.
- **harness#202 (2026-08-13)** — ca gate ② trong `test-hooks.mjs` dùng `root: null`, tức chính
  repo đang chạy suite, rồi khẳng định kết quả của vai `template`. Ở repo tiêu thụ `gates.mjs`
  fail-đóng exit 2 **đúng như thiết kế**, nên ca này đỏ vĩnh viễn ở mọi project đã áp template.
  Tìm ra khi sakubun bắt kịp 2.13.0 → 2.75.0 (PR #33 của repo này).

Ba lần, ba công cụ khác nhau, cùng một giả định ngầm.

**Lớp lỗi:** verification

**Dạng biểu diễn đề xuất:**

```
1 test/contract  2 generator  3 computational-control  4 verification-skill
5 gotcha 1 dòng  6 skill      7 rule cứng
```

Chọn: `3` — computational-control.

Cụ thể: một phép kiểm tất định quét `tooling/test-hooks.mjs` (và mọi self-check khác) tìm các
ca **khẳng định kết quả trên `repoPath('')` mà không rẽ theo `repoRole()`**. Harness đã có sẵn
`repoRole()` và đã có idiom `if (repoRole() === 'template') { … } else skipped += 1` dùng ở hai
chỗ khác trong chính file đó — nên đây là chuyện **cưỡng chế một idiom đã tồn tại**, không phải
phát minh cơ chế mới.

Vì sao không dùng được dạng rẻ hơn:

- **(1) test/contract** là thứ đang HỎNG. Chính suite tự kiểm là nơi lỗi sống, nên không thể
  dùng "viết thêm một test" làm câu trả lời mà không nói rõ test đó kiểm cái gì — và khi nói rõ
  thì nó chính là (3).
- **(2) generator** không áp được: các ca test viết tay theo tình huống, không sinh ra từ khuôn.

**Tầng:** org — lỗi nằm trong template, mọi repo tiêu thụ đều thừa hưởng.

**Scope:** `universal`

Test *"nếu tôi xoá repo này, mục này còn giá trị không?"* → **còn**. Nó là thuộc tính của mô hình
template-và-repo-tiêu-thụ, không của sakubun.

**Đặt ở tầng nào của thang độ trễ:** CI của repo `harness` (job `guards`). Không đặt được ở tầng
nhanh hơn — pre-commit của template không thể biết một ca sẽ hành xử thế nào ở repo tiêu thụ;
phải chạy suite với `repoRole()` giả lập cả hai vai, và đó là việc của CI chứ không của hook.

**Chi phí bảo trì dự kiến:** thấp. Phép kiểm bám vào một hàm đã có (`repoRole`) và một idiom đã
có. Rủi ro chính là dương tính giả với ca cố ý giống nhau ở cả hai vai — giảm bằng cách chỉ báo
khi ca đó **khẳng định một chuỗi thông điệp đặc trưng vai** (`REPO TEMPLATE`, `KHÔNG có người
ngồi xem`), không báo mọi ca dùng `root: null`.

**ĐIỀU KIỆN THOÁT:** hết cần khi `test-hooks.mjs` không còn ca nào chạy trên `repoPath('')` mà
kết quả phụ thuộc vai — ví dụ khi mọi ca đều dựng fixture tường minh cho từng vai như ca ④ và ⑤
đang làm. Lúc đó phép kiểm này không còn gì để bắt và nên bị cắt.

---

## Mục thứ hai, nhỏ hơn: `budget.plan` chưa khai ở `harness.config.json`

Không phải đề xuất đổi cơ chế — là một **giá trị cấu hình** mà agent không được sửa và không
biết đáp án.

`budgetPlan()` (`tooling/lib/harness.mjs`) đọc `cfg.budget.plan`; `harness.config.json` của
sakubun chưa khai key đó, nên nó rơi về mặc định **lặng lẽ** và người sửa config không biết mình
vừa tắt một cái cap. Template có khai sẵn (`"plan": "metered"`) kèm comment giải thích.

Đáp án phụ thuộc gói cước đang trả, và đó là sự thật kinh doanh:

- `metered` — trả theo mức dùng (API pay-as-you-go): so run-rate USD với `monthlyUsdCap`.
- `flat` — subscription Pro/Max: chi tiêu **bằng định nghĩa** đúng bằng trần nên so USD luôn ra
  `over` và cảnh báo không bao giờ tắt. Cổ chai thật là **rate limit**, đo bằng `budget-alarm.log`.

Đề nghị `flat`, vì repo này dùng Claude Code qua subscription. Đây là một dòng:

```json
"budget": { …, "plan": "flat" }
```

**ĐIỀU KIỆN THOÁT:** hết cần khi `budgetPlan()` không còn `?? mặc-định` — tức khi thiếu key là
lỗi cứng chứ không phải im lặng.

---

## Đề xuất CẮT BỎ

- [x] ~~`entropy-scan` báo skill `verify-ui` **gần như không được nhắc tới ở đâu — ứng viên GỠ BỎ**.~~
      **BÁC — 2026-08-14, sau khi DRI uỷ quyền quyết.** Lần kiểm trước SAI, và sai theo cách đáng ghi:
      tôi kiểm `.claude/settings.json` và "PR tuần qua", tức đúng những chỗ một skill KHÔNG sống.
      Đo lại đúng chỗ thì nó có hai điểm vào, chỗ thứ hai mạnh hơn văn xuôi:
      · `.claude/skills/ship-feature/SKILL.md:63` — một GATE trong quy trình ship;
      · `tooling/check-feature-integrity.mjs:127` — thông điệp lỗi do MÁY sinh.
      Và `HARNESS-CHANGELOG.md:1117` ghi rằng skill này ĐÃ từng mồ côi thật rồi được chữa
      *"bằng cách nối vào vòng lặp, không phải xoá"* — nên gỡ nó là hoàn tác một bản sửa có chủ ý.
      Lỗi thật nằm ở công cụ: `entropy-scan` chỉ đọc `.md` nên không thấy tham chiếu trong code, và
      ngưỡng `mentions <= 1` phạt đúng trạng thái mà LUẬT 1 của `.claude/rules/README.md` yêu cầu
      (một chủ đề, một file ⇒ một điểm vào là ĐÚNG). Mở issue #45 — phát hiện thứ BẢY cùng lớp
      "công cụ chẩn đoán tự tin nhưng sai" (#4, #5, #8, #13).
      Bài học riêng cho chính tôi: khi định xoá một thứ vì "không ai dùng", `grep` phải quét CODE
      chứ không chỉ tài liệu — thông điệp lỗi do máy sinh là tham chiếu đáng tin nhất, vì nó hỏng
      lộ ra ngay còn văn xuôi thì mục im lặng.
- [x] `AGENTS.md` đang **154 dòng (>150)** — chính file đó đặt ngưỡng cho mình. Ứng viên chuyển đi:
      mục **Đa hệ điều hành — Parity Contract** đã được cưỡng chế bằng máy (`harness-parity.yml`
      chạy 3 OS + `no-bash-in-harness`), nên nó thuộc `.claude/rules/` theo path chứ không cần
      ngồi trong file mọi người đọc ngày đầu.
