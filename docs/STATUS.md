# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-27 (kế hoạch Kaiwa canvas chờ duyệt).

## Đang làm

| Bước | Nhánh / PR | Giữ bởi | Trạng thái |
| --- | --- | --- | --- |
| 8 K2 MCP `kaiwa_save`, `kaiwa_get`, `kaiwa_list`, prompt `kaiwa` | `feat/8-k2-kaiwa-mcp` (#152) | Claude (phiên của thien, 2026-10-27) | PR mở, chờ thien merge; đường dẫn xem kịch bản chỉ mở được khi có K3 |

## Chờ thien

- Merge K2 (#152, MCP Kaiwa, risk:high), rồi thử trong claude.ai: nhờ Claude soạn một đoạn hội thoại ngắn trên canvas rồi lưu.
- Muốn trần khác 50 tài khoản thì đặt `MAX_ACCOUNTS` trên NUC.
- Sau khi bản 7.3 lên NUC: mở Cài đặt > Hướng dẫn, kiểm địa chỉ MCP là `https://sakubun.thientnse.site/api/mcp`.
- Gỡ runner `tnt-laptop-wsl` khỏi repo nếu còn (Settings > Actions > Runners).
- Kiểm app sau khi bản 7.1d lên NUC (sao lưu trước đó: `~/backups/sakubun-before-7.1d-20261027T030406Z.db`).

## Tiếp theo

1. Phase 7.2 xong: quyền theo vai trò (#138), kho OpenJLPT cho người mới (#139), `/admin` và trang từng tài khoản
   (#140), mở đăng ký (#141), Ứng dụng đã kết nối với thu hồi ngay (#142).
2. Phase 7.3 xong 2026-10-27: kế hoạch (#146), tab Hướng dẫn trong Cài đặt (#147), thẻ "Kết nối Claude" trên
   Phân tích cho người chưa kết nối AI và chưa ôn (#148). Luồng claude.ai đã thử thật bằng tài khoản thứ hai.
3. Phase 8 duyệt 2026-10-27 (#150, `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md`): Kaiwa sơ bộ K1–K5 trước
   (AI soạn và lưu kịch bản qua MCP), rồi kho chung L1–L6, Ôn nhanh (C) và 7.4 cùng các lỗi bên dưới, rồi K6–K9.

## Việc nhỏ còn treo

- Trang đồng ý OAuth ("Cho phép truy cập Sakubun?") không ghi đang cấp quyền cho tài khoản nào; trình duyệt đang
  đăng nhập sakubun bằng tài khoản khác thì connector âm thầm nối sai tài khoản (thử thật 2026-10-27). Nên hiện email
  trên trang đó (đụng OAuth, risk:high).
- Lượt thử 2026-10-27: Claude đọc kết quả `status` thành "18 mục đến hạn, 100 lượt ôn" trong khi đó là hạn mức ngày
  (tài khoản mới có 0 đến hạn). Cần làm chữ của `status` rõ hơn giữa "đến hạn" và "hạn mức".
- e2e `critical-path` chờ "Chưa có gì để học" nhưng fail khi chạy chung DB với spec khác đã thêm dữ liệu.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- `recordReviews` chưa gọi `invalidateStreak` sau mỗi lần ôn, nên chuỗi ngày có thể hiện chậm tới 60 giây
  (`lib/insights/streak.ts`; cache giờ theo từng người học).
- Chữ "Xóa" và "Xoá" dùng lẫn lộn trong UI; chọn một cách viết (repo đang dùng "Xoá" trong tài liệu).
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
