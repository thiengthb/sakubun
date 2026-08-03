# AGENTS.md

> Hợp đồng làm việc trong repo này, cho **cả người và agent**.
> Đây là file duy nhất bạn phải đọc ngày đầu. Mọi thứ khác tự kích hoạt khi cần.
> Đổi file này = PR + 1 approve. Chủ: xem `.github/CODEOWNERS`.
>
> **Giữ dưới ~150 dòng.** Dài hơn nghĩa là có thứ thuộc về `.claude/rules/` (theo path),
> một skill (kiến thức thỉnh thoảng cần), hoặc một hook (luật bắt buộc).

## Project

<!-- 2–3 câu. Sản phẩm làm gì, cho ai. Không mô tả cây thư mục — agent tự thấy. -->
sakubun là app luyện dịch Nhật–Việt theo ngữ pháp, **MỘT người dùng, deploy thật, sau
/login**. Người học luyện bằng cách nói chuyện với Claude Desktop qua MCP; **app giữ dữ
liệu, FSRS, hạn mức ngày và cài đặt**, còn Claude soạn câu và chấm. Web gồm 5 trang:
Phân tích · Tài nguyên · Lịch sử · Cài đặt · Hướng dẫn.

Bản **nhiều người dùng + cộng đồng** (nhóm, thư viện chung, feed, thông báo, admin) nằm ở
nhánh `feat/multiuser-community` — lấy lại từ đó, đừng dựng lại từ đầu.
Cấu hình harness: `harness.config.json` — mọi lệnh, ngưỡng, vùng nóng khai ở đó.

## Lệnh

<!-- Đặt LỆNH TRƯỚC VĂN XUÔI. Đây là thứ agent dùng nhiều nhất. -->

| Việc | Lệnh |
|---|---|
| Dựng môi trường (chạy được mọi OS) | `node tooling/init.mjs` |
| Verify toàn bộ | `npm run verify` |
| Sinh code từ schema | `npm run gen` (prisma generate → `lib/generated/prisma`) |
| Test một file | `npx vitest run lib/<tên>.test.ts` |
| E2E thật (browser) | `npx playwright test` |
| Chạy app (dev) | `npm run dev` → http://localhost:3789 |
| Migration mới | `npm run db:migrate -- --name <slug>` |

## Gotchas

<!--
  PHẦN GIÁ TRỊ NHẤT CỦA FILE NÀY. Chỉ giữ thứ Claude KHÔNG suy ra được từ repo.
  Xoá mọi dòng mà agent tự đọc code là biết. Xoá mọi "persona".
  Xoá mọi negative constraint không thuộc 3 nhóm nguy hiểm (production, secret,
  migration đã merge) — chỉ thị xung đột làm model tốn năng lực dàn hoà trước
  khi làm việc thật.
-->

- **KHÔNG còn tenancy, ranh giới là ĐĂNG NHẬP.** Dữ liệu học (Item, SrsState, ReviewLog,
  Sentence, Settings, LearnerAbility, LearnerNote, CalibrationProposal) **không có cột
  `userId`**, và guard fail-closed trong `lib/db.ts` đã bị bỏ cùng với nó. Cái chặn người
  lạ giờ là: `getSessionUserId()` ở mỗi page/server action, `withMcpAuth({required:true})`
  ở route MCP, và **đăng ký đóng sau tài khoản đầu tiên** (`assertRegistrationOpen` trong
  `lib/auth.ts`, chạy ở hook `user.create` nên cả Google OAuth cũng không lách được).
  `userId` chỉ còn ở tầng auth: Session · Account · Verification · McpKey.
- **Test cô lập bằng `resetData()`, không bằng user mới.** Unique của Item là
  `[kind, expression]`, nên hai test seed cùng một mẫu sẽ đụng khoá nếu chưa dọn bảng.
  Streak có cache module-level: gọi `invalidateStreak()` khi xoá ReviewLog thẳng vào DB.
- **Ngôn ngữ là hợp đồng, không phải style.** Code/comment/commit: tiếng Anh. Mọi chuỗi
  người học đọc trên UI: **tiếng Việt**. Text gửi cho Claude qua MCP: tiếng Anh, trừ block
  render sẵn để Claude echo nguyên văn (`verbatim: true`) thì tiếng Việt.
  **Không emoji ở đâu cả** — `lib/no-emoji.test.ts` bắt kèm `file:line`.
- **`submitReview()` trong `lib/practice.ts` là lối duy nhất TÍNH lịch FSRS.** Route,
  component, MCP tool không được ghi `SrsState` trực tiếp. Ngoại lệ duy nhất là
  `lib/import.ts` — nó *restore nguyên văn* state đã lưu từ backup, không tính lại.
  `ReviewLog` chỉ append; xoá Item thì `itemId` thành null (`SetNull`) nên mọi reader phải
  chịu được null.
- **Prisma 7 ở đây dùng driver adapter** (`@prisma/adapter-better-sqlite3`), client sinh ra
  `lib/generated/prisma`, CLI đọc `prisma.config.ts` — `schema.prisma` **không** có `url`.
  Đây không phải setup Prisma cổ điển; đọc docs Prisma 7 trước khi sửa tầng DB.
- Mọi chuỗi tiếng Nhật người học đọc **phải** đi qua `<SpokenLine>` — furigana + phát + karaoke.
- **Web không sinh câu và không chấm.** Repo không gọi API Anthropic ở đâu cả; MCP một chiều
  — Claude gọi app. Cần Claude làm gì thì đưa người học câu để dán sang Claude Desktop.
- Google sign-in chỉ bật khi có **cả hai** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`;
  thiếu một cái thì provider bị bỏ hẳn để app không boot OAuth nửa vời.
- **`npm test` cần consent của người.** 10 file trong `lib/*.test.ts` gọi `prisma db push`
  lên DB **tạm, rỗng** (`mkdtempSync`); Prisma 7 phát hiện agent và chặn, nên **stop-gate
  luôn đỏ ở bước `test`** dù code đúng. Agent phải HỎI, rồi chạy với
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=<câu đồng ý>`. **Đừng đặt nó thành mặc
  định** — xem `.claude/learnings/2026-W32-thien.md`.

## Làm việc trong repo dùng chung (bắt buộc)

- Bắt đầu mọi session: `pwd`, `git branch --show-current`, `git log --oneline -10 origin/main`.
  SessionStart hook in sẵn — **đọc nó**.
- **Một issue = một nhánh = một worktree.** Không làm 2 issue trong một worktree.
- Trước khi sửa file trong **vùng nóng** (xem `harness.config.json → paths.hot`):
  kiểm `gh pr list --state open` và `reservations/`. Có chồng lấn → **báo người, đừng tự quyết**.
- **KHÔNG sửa**: `.claude/settings.json`, `.claude/hooks/**`, `.mcp.json`, `AGENTS.md`, `harness.config.json`.
  Dùng `/harness-propose`. (Hook sẽ chặn — đó là cố ý.)
- **KHÔNG sửa** file feature của issue khác. **KHÔNG sửa** `features/_index.json`.
- **KHÔNG** push lên nhánh người khác. **KHÔNG** force push. **KHÔNG** rebase nhánh chung.
- Nhật ký vào `docs/progress/<issue>.md`, **không** vào một file chung.
- Bài học vào `.claude/learnings/<năm>-W<tuần>-<tên>.md` — một file của riêng bạn, không bao giờ conflict.
- Số session song song tối đa mỗi người: xem `harness.config.json → limits.maxSessionsPerPerson`.

## Verification (không thương lượng)

- **Default-FAIL.** Mọi tiêu chí bắt đầu là `false`. Agent không đổi được nếu chưa có bằng chứng.
- `evidence` bắt buộc khi `passes: true`: đường dẫn tới output test / CI job / screenshot thật.
  **"Tôi đã kiểm tra" KHÔNG phải bằng chứng.**
- Bắt buộc E2E thật (browser/device), không chỉ unit test + curl.
- Một feature chỉ DONE khi **mọi platform trong scope** pass. Ngoài scope ghi `"n/a"`, không ghi `true`.
- Ưu tiên **computational control** (typecheck, lint, test, grep rule) trước **inferential control** (LLM chấm).
  Mỗi lần định nhờ LLM chấm, hỏi trước: có biến thành check tất định được không?

## Git & PR

- Nhánh từ `origin/main` mới nhất. Tên: `<type>/<issue>-<slug>`, thêm `--agent` nếu agent chạy tự trị.
- **Một PR một mục đích.** Vượt ngưỡng ở `limits.prWarnLines` → chẻ hoặc nêu lý do trong PR.
- **Tuổi nhánh < 1 ngày.** Cửa sổ chồng lấn tỉ lệ với tuổi nhánh.
- Conventional Commits, kèm `Refs:` và `Co-Authored-By:` nếu agent viết phần lớn.
- Trước khi mở PR: chạy `/pre-merge`. Điền đầy đủ PR template, **đặc biệt mục Bằng chứng**.
- Đổi public surface (`paths.publicSurface`): liệt kê consumer + gắn label `breaking` + **sửa cùng PR**.
  Không bao giờ để consumer "sửa sau trong PR khác".
- Lockfile conflict: checkout một bên rồi chạy lại install. **Không merge tay.**
- Sau khi merge: xoá nhánh + worktree tương ứng.

## Đa hệ điều hành — Parity Contract

Mọi thứ trong harness của team **phải** chạy trên Ubuntu 22+, macOS 14+, Windows 11.

- Cơ chế không chạy được cả ba → **không được vào `.claude/`**. Nó thuộc `settings.local.json`.
- Mọi script harness viết bằng **Node (`.mjs`)**, không bash/PowerShell.
- `os.homedir()` · `os.tmpdir()` · `path.join()` — không bao giờ `$HOME`, `/tmp`, nối chuỗi `/`.
- CI test hook trên cả 3 OS. Hook fail trên một OS = hook bị revert.
- Thành viên Windows: **WSL2 là khuyến nghị mặc định**, repo để trong `~/dev/` (KHÔNG `/mnt/c`, KHÔNG OneDrive).

## Trước khi viết code mới

- Tìm trong repo trước (`rg`). Không tạo helper trùng chức năng đã có.
- Capability > ~200 dòng → chạy `/research-first` trước khi implement.
- **KHÔNG tự viết**: crypto, auth/session/OAuth, payment, date-time math, parser, rate limiter phân tán, i18n plural.
- Trước khi tin một tài liệu cũ hơn `limits.docStaleDays` ngày: **verify với code hiện tại**.

## Đọc thêm (chỉ khi cần, đừng đọc hôm nay)

| Bạn cần | Đọc |
|---|---|
| Áp harness lên project mới | `README.md` · `docs/ROADMAP-30D.md` |
| Hiểu vì sao có conflict lạ | `docs/CONFLICTS.md` |
| Quyết số session song song | `docs/WIP.md` |
| Cấu trúc code / ranh giới module | `docs/ARCHITECTURE.md` |
| Ngân sách, cap, CAPO | `docs/ECONOMICS.md` |
| Agent hỏng giữa chừng | `docs/RECOVERY.md` |
| Vai trò DRI, nhịp team | `docs/TEAM.md` |
| Nhiều repo cùng lúc | `docs/MULTI-PROJECT.md` |
| Có gì đó sai mà chưa gọi tên được | `docs/ANTI-PATTERNS.md` |
| Mang trí tuệ sang project khác | `knowledge/README.md` |

## Khi bạn học được điều gì

Agent lỗi cùng một kiểu **≥2 lần** → `/harness-propose`, không sửa tay lần nữa.
Bài học được promote sẽ vào `knowledge/lessons/` và **đi theo bạn sang project khác**.
Xem `knowledge/README.md`.
