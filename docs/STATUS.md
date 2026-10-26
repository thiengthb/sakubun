# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-26.

## Đang làm

| Bước        | Nhánh / PR                           | Giữ bởi                                                 | Trạng thái                    |
| ----------- | ------------------------------------ | ------------------------------------------------------- | ----------------------------- |
| 7.1b + 7.1c | `claude/project-thread-5kvuk6`, #131 | phiên `session_01T9DcRAaagJRZ7mH5PyFjJM` (tài khoản cũ) | Xong code, CI xanh. Chờ thien |

## Chờ thien

- #131: sao lưu DB trên NUC rồi merge (`risk:high`, có migration dữ liệu backfill).
- PR này (trang trạng thái và kế hoạch 7.1 trong repo): merge (`risk:high` vì đổi luật làm việc).

## Tiếp theo

1. 7.1d, sau khi #131 merge: `userId` bắt buộc (backfill trước), Item unique theo (userId, kind, expression),
   client trần ném lỗi trên 8 bảng học, test quét raw SQL. Kế hoạch:
   `docs/plans/2026-10-25-phase7-1-per-user-data.md`. Sao lưu NUC trước khi deploy.
2. 7.2: đăng ký thien duyệt, trang quản trị, rồi 4.2. Không mở đăng ký trước khi 7.1d merge.

## Việc nhỏ còn treo

- e2e `critical-path` chờ "Chưa có gì để học" nhưng fail khi chạy chung DB với spec khác đã thêm dữ liệu.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
