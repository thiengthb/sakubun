# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-27 (kế hoạch 7.2 duyệt, nhận 7.2a).

## Đang làm

| Bước | Nhánh / PR | Giữ bởi | Trạng thái |
| --- | --- | --- | --- |
| 7.2a | `feat/7.2a-admin-only-gates` | phiên `session_01FokVawKvZGmPLu9XkUuTAp` (từ 2026-10-27) | Đang code |
| 7.2b | `feat/7.2b-starter-deck` | phiên `session_01FokVawKvZGmPLu9XkUuTAp` (từ 2026-10-27) | PR mở, `risk:low`, AI merge khi CI xanh |

## Chờ thien

- Gỡ runner `tnt-laptop-wsl` khỏi repo nếu còn (Settings > Actions > Runners).
- Kiểm app sau khi bản 7.1d lên NUC (sao lưu trước đó: `~/backups/sakubun-before-7.1d-20261027T030406Z.db`).

## Tiếp theo

1. 7.2a đến 7.2e theo `docs/plans/2026-10-27-phase7-2-sign-up.md` (mở đăng ký không cần duyệt, thien chặn
   được). 7.2d mở cửa cuối cùng.

## Việc nhỏ còn treo

- e2e `critical-path` chờ "Chưa có gì để học" nhưng fail khi chạy chung DB với spec khác đã thêm dữ liệu.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- `recordReviews` chưa gọi `invalidateStreak` sau mỗi lần ôn, nên chuỗi ngày có thể hiện chậm tới 60 giây
  (`lib/insights/streak.ts`; cache giờ theo từng người học).
- Khôi phục bản sao lưu toàn hệ thống so email phân biệt hoa thường (`lib/transfer/import.ts`), nên có thể tạo
  một tài khoản trùng. Cần sửa trước khi 7.2 mở đăng ký.
- Chữ "Xóa" và "Xoá" dùng lẫn lộn trong UI; chọn một cách viết (repo đang dùng "Xoá" trong tài liệu).
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
