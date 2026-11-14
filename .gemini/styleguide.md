# Hướng dẫn review cho sakubun

Viết mọi góp ý bằng tiếng Việt tự nhiên. Tên hàm, tên file, lệnh giữ nguyên tiếng Anh.

sakubun là app luyện tiếng Nhật (Next.js, Prisma 7 trên SQLite), mỗi người học một kho riêng. Luật đầy đủ ở `CLAUDE.md` và `AGENTS.md`.

## Ưu tiên khi review
1. **Lộ dữ liệu giữa người học.** Mọi truy vấn trên các bảng học phải đi qua `userDb(userId)` (`lib/db/user-db.ts`); tạo dòng thì ghi `userId: db.$ownerId()`. Dùng client chung `prisma` hay SQL viết tay trên bảng học là lỗi nặng.
2. **Lịch ôn FSRS.** `recordReviews()` trong `lib/app/record-review.ts` là lối duy nhất ghi `SrsState`. `ReviewLog` chỉ được thêm, không sửa hay xoá.
3. **Quyền và đăng nhập.** Cửa nào cũng hỏi `accountAccess()` (`lib/auth/access.ts`); route MCP bắt buộc token; đăng nhập bằng email/mật khẩu chỉ cho test, phải tắt ở production.
4. **Migration** chỉ được cộng thêm, hoặc có bước chuyển dữ liệu kèm test.
5. **Test bị làm yếu cho xanh**: bỏ phép kiểm, nới allowlist trong `lib/design/` mà không ghi lý do, thêm vào `thienui-debt.json`.
6. Giao diện: chuỗi người học đọc phải tiếng Việt, không emoji; nút bấm được bằng bàn phím, đủ tương phản.

## Không cần góp ý
- Văn phong tài liệu trong `docs/`, trừ khi sai nghĩa.
- Tự viết crypto, auth/session, phép tính ngày giờ: luôn dùng thư viện đã có; nếu thấy code tự viết thì mới góp ý.
