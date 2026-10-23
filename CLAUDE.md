# sakubun

App luyện tiếng Nhật cho **một người dùng**, chạy thật sau `/login`. App giữ dữ liệu, lịch ôn **FSRS**, hạn mức ngày và cài đặt;
**AI (Hermes / Claude) là thầy qua MCP**: soạn câu, chấm, hội thoại. Web không tự sinh câu, không tự chấm.
Cấu trúc thư mục, luật frontend, deploy: xem `README.md`.
Luật làm việc chung (mọi thay đổi đi qua PR, script NUC chỉ chạy sau khi merge…): xem `CLAUDE.md` của repo `thiengthb/nuc-infra`.
Kế hoạch hợp nhất (wordquiz + kaiwa vào đây): `nuc-infra/docs/research/2026-10-10-app-merge-plan.md`.

## Lệnh

| Việc | Lệnh |
|---|---|
| Chạy dev | `npm run dev` → http://localhost:3789 |
| **Kiểm tra toàn bộ (bắt buộc trước khi coi là xong)** | `npm run verify` (gen → typecheck → lint → test → build) |
| Một file test | `npx vitest run lib/<miền>/<tên>.test.ts` |
| E2E (browser thật) | `npm run e2e` |
| Migration mới | `npm run db:migrate -- --name <slug>` |

## Gotchas

- **`submitReview()` trong `lib/library/practice.ts` là lối DUY NHẤT tính lịch FSRS.** Không route/component/MCP tool nào ghi `SrsState` trực tiếp
  (ngoại lệ: nhập lại bản sao lưu nguyên văn). `ReviewLog` chỉ append; xoá Item thì `itemId` thành null.
- **Prisma 7 dùng driver adapter** (`@prisma/adapter-better-sqlite3`), client sinh ở `lib/generated/prisma` (không commit), CLI đọc `prisma.config.ts`.
- **Test có DB dùng `createTestDb()` (`lib/db/test-db.ts`)**, không dùng `prisma db push`; dọn giữa các test bằng `resetLearningData()`.
- **Một người dùng, ranh giới là đăng nhập**: dữ liệu học không có `userId`; chỉ đăng nhập bằng Google với đúng `ALLOWED_EMAIL`, đăng ký đóng sau tài khoản đầu tiên (`lib/auth/auth.ts`, `lib/auth/login-policy.ts`); email/mật khẩu chỉ là cửa cho test, tắt cứng ở production;
  route MCP (`app/api/[transport]/route.ts`) bắt buộc token.
- **Ngôn ngữ**: code/comment/commit tiếng Anh; chuỗi người học đọc trên UI tiếng Việt; không emoji.
- **Luật frontend là test** trong `lib/design/`. Phá luật thì thêm vào allowlist trong test đó, kèm lý do.
- Không tự viết crypto, auth/session, date-time math: dùng thư viện đã có.
- Không bao giờ sửa test cho xanh bằng cách làm yếu phép kiểm; sửa code.

## Git

Nhánh từ `main`, Conventional Commits, PR nhỏ một mục đích; CI chạy `npm run verify`.

## Cách làm việc giữa người và AI

- **Người quyết cái gì và vì sao** (mục tiêu, hành vi học, schema, xoá dữ liệu); **AI làm và chứng minh nó chạy**
  (nhánh, code, test, PR, sửa CI và review comment).
- AI không push thẳng `main`, không đụng production. Merge theo nhãn rủi ro của `nuc-infra/AGENTS.md`:
  `risk:low` (docs, test, code chưa nối vào app) AI merge khi CI xanh; `risk:medium` AI merge khi CI xanh và một
  phiên khác đã review; `risk:high` (luật làm việc, OAuth, secret, xoá dữ liệu, ngoài lộ trình) thien merge.
- Lộ trình đã duyệt nằm ở `docs/roadmap.md`; việc ngoài lộ trình thì hỏi trước.
- Việc nhỏ, rõ: AI làm luôn và mở PR. Việc lớn (đổi hành vi học, schema, kiến trúc): AI viết kế hoạch ngắn,
  người duyệt rồi mới code.
- Mỗi PR một mục đích, nên dưới khoảng 400 dòng thay đổi; mô tả nói rõ hành vi trước và sau.
- **Xong** = `npm run verify` xanh, có test cho hành vi mới, CI xanh, merge đúng theo nhãn rủi ro. Đổi UI thì kèm ảnh chụp
  hoặc chạy `npm run e2e`.
- Quyết định thiết kế lớn ghi một file ngắn `docs/decisions/NNNN-<slug>.md` (bối cảnh, quyết định, hệ quả).
- Logic thuần (không Prisma, không I/O) tách khỏi truy vấn DB.
- Luật nào server ép được thì ép trong code, trả lỗi ngắn nêu một cách sửa; không dựa vào văn bản hướng dẫn AI.
- Migration chỉ cộng thêm, hoặc có bước chuyển dữ liệu kèm test; sao lưu DB trên NUC trước khi deploy
  migration đụng dữ liệu học.
- File này giữ ngắn: lệnh, gotchas, luật. README cho người đọc; `docs/decisions/` cho lịch sử quyết định.
