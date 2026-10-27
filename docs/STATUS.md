# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-27 (nhận 7.3, kế hoạch đã duyệt).

## Đang làm

| Bước | Nhánh / PR | Giữ bởi | Trạng thái |
| --- | --- | --- | --- |
| 7.3 Hướng dẫn | `docs/7.3-guide-plan` (kế hoạch), rồi `feat/7.3a-guide-tab` | Claude (phiên của thien, 2026-10-27) | 7.3a tab Hướng dẫn trong PR, chờ thien duyệt ảnh; còn thử luyện bằng tài khoản thứ hai |

## Chờ thien

- Đăng nhập bằng tài khoản Google thứ hai đã chạy
  (thien thử 2026-10-27); muốn trần khác 50 tài khoản thì đặt `MAX_ACCOUNTS` trên NUC.
- Gỡ runner `tnt-laptop-wsl` khỏi repo nếu còn (Settings > Actions > Runners).
- Kiểm app sau khi bản 7.1d lên NUC (sao lưu trước đó: `~/backups/sakubun-before-7.1d-20261027T030406Z.db`).

## Tiếp theo

1. Phase 7.2 xong: quyền theo vai trò (#138), kho OpenJLPT cho người mới (#139), `/admin` và trang từng tài khoản
   (#140), mở đăng ký (#141), Ứng dụng đã kết nối với thu hồi ngay (#142).
2. thien chọn 7.3 (viết lại trang Hướng dẫn) trước 7.4. Sau khi kế hoạch được duyệt: 7.3a tab Hướng dẫn trong Cài đặt,
   7.3b thẻ "Kết nối Claude" trên Phân tích.

## Việc nhỏ còn treo

- e2e `critical-path` chờ "Chưa có gì để học" nhưng fail khi chạy chung DB với spec khác đã thêm dữ liệu.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- `recordReviews` chưa gọi `invalidateStreak` sau mỗi lần ôn, nên chuỗi ngày có thể hiện chậm tới 60 giây
  (`lib/insights/streak.ts`; cache giờ theo từng người học).
- Chữ "Xóa" và "Xoá" dùng lẫn lộn trong UI; chọn một cách viết (repo đang dùng "Xoá" trong tài liệu).
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
