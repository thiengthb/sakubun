# sakubun

App luyện tiếng Nhật cho **một người dùng**, chạy thật sau `/login`. App giữ dữ liệu, lịch ôn **FSRS**, hạn mức ngày và cài đặt;
**AI (Hermes / Claude) là thầy qua MCP**: soạn câu, chấm, hội thoại. Web không tự sinh câu, không tự chấm.
Kế hoạch hợp nhất (wordquiz + kaiwa vào đây): `nuc-infra/docs/research/2026-10-10-app-merge-plan.md`.

## Lệnh

| Việc | Lệnh |
|---|---|
| Chạy dev | `npm run dev` → http://localhost:3789 |
| **Kiểm tra toàn bộ (chạy trước khi coi là xong)** | `npm run verify` (gen → typecheck → lint → test → build) |
| Một file test | `npx vitest run lib/<tên>.test.ts` |
| E2E (browser thật) | `npx playwright test` |
| Sinh Prisma client | `npm run gen` |
| Migration mới | `npm run db:migrate -- --name <slug>` |
| Chạy thử một buổi học trọn vẹn | `node tooling/learning-lab.mjs` (xem `docs/LEARNING-LAB.md`) |
| Khôi phục DB từ máy khác | `node tooling/db-restore.mjs <file.db>` |

## Gotchas (kiến thức không tự suy ra được từ code)

- **`submitReview()` trong `lib/practice.ts` là lối DUY NHẤT tính lịch FSRS.** Route, component, MCP tool không ghi `SrsState` trực tiếp.
  Ngoại lệ duy nhất: `lib/import.ts` khôi phục nguyên văn state từ backup. `ReviewLog` chỉ append; xoá Item thì `itemId` thành null.
- **Prisma 7 dùng driver adapter** (`@prisma/adapter-better-sqlite3`), client sinh ở `lib/generated/prisma`, CLI đọc `prisma.config.ts`;
  `schema.prisma` không có `url`. Đọc docs Prisma 7 trước khi sửa tầng DB.
- **Test có DB dựng bằng `createTestDb()` (`lib/test-db.ts`), không bằng `prisma db push`.** Gọi trước khi import `@/lib/db`.
  Cô lập test bằng `resetData()`. Streak có cache: gọi `invalidateStreak()` khi xoá ReviewLog trực tiếp.
- **Một người dùng, ranh giới là đăng nhập.** Dữ liệu học không có `userId`; chặn người lạ bằng `getSessionUserId()` ở page/action,
  `withMcpAuth({required:true})` ở MCP, và đăng ký đóng sau tài khoản đầu tiên (`assertRegistrationOpen`).
- **Ngôn ngữ:** code/comment/commit tiếng Anh; mọi chuỗi người học đọc trên UI tiếng Việt; text gửi AI qua MCP tiếng Anh
  (trừ block `verbatim: true` thì tiếng Việt). Không emoji (`lib/no-emoji.test.ts` bắt).
- Mọi chuỗi tiếng Nhật người học đọc **phải** đi qua `<SpokenLine>` (furigana + phát âm + karaoke).
- **Luật giao diện** nằm ở `docs/ui-patterns.json`, có test cưỡng chế (`lib/ui-pattern-lock.test.ts`). Thiết kế: `docs/DESIGN.md`.
- Google sign-in chỉ bật khi có **cả hai** `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.
- Không tự viết crypto, auth/session, date-time math: dùng thư viện đã có.

## Git

Nhánh từ `main`, Conventional Commits, PR nhỏ một mục đích. `npm run verify` xanh trước khi mở PR.
