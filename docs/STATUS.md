# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-09 · Claude (thread "Đọc bàn giao và làm tiếp Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

Luyện dịch R1–R4, Kaiwa (a)–(d), kanji KJ1–KJ7 đã xong. UI v2 (`docs/plans/2026-11-08-ui-v2.md`): U0 xong và thien đã duyệt
ảnh. U1 (khung app): Base UI #276–#282, sidebar 3 nhóm #283, thanh 5 tab #284 (kèm sửa số thẻ đến hạn sau buổi ôn);
Lịch sử thành Tiến độ ở `/progress` (PR này; `/history` chuyển hướng giữ query, tab "Luyện dịch" đổi thành "Lịch sử dịch").
Phân tích vẫn ở `/`: Tổng quan và Thống kê vào Tiến độ ở U7, Hôm nay thay `/` ở U3.

## U1 còn lại

1. Cổng U1: thien duyệt ảnh trên https://claude.ai/artifact/9Hd8pSLPK63CUFMcX4Tshx (làm lại 09/11 ở tài khoản này, trang cũ đã mất) và đi thử 5 tab
   trên điện thoại thật. Duyệt xong thì đánh U1 Done trong roadmap và nhận U2 (Phiên học, risk:high).

## Đang chờ thien (tối đa 3)

1. **Hiện lại "N5 · Ngữ pháp"**: trang Quản trị, mục "Đã ẩn khỏi Kho chung", bấm Hiện.
2. **Thử chia sẻ kịch bản** trên NUC: chia sẻ, mở link ở cửa sổ ẩn danh, Lấy về bằng tài khoản thứ hai (`kai`); phần MCP Claude đã thử, chạy đúng.

## Việc nhỏ còn treo

- Trên điện thoại, tab Bạn mở Tiến độ; Cài đặt chỉ tới được qua nút menu ở đầu trang (kế hoạch muốn nó nằm trong tab Bạn, làm ở U7).
- Trên điện thoại, nút ⋯ của trang kịch bản nằm riêng một hàng để khớp màn hình đang tải; đổi thì đổi cả hai.
- e2e không chạy trong CI, chạy tay trước PR đổi UI; `style-audit` đỏ trên main khi chạy sau kaiwa/quick-review (cần PR riêng);
  `quick-review` "lost answer" đỏ tuỳ thứ tự, chạy riêng thì xanh. Tabs Base UI không tự chọn khi di phím (thêm `activateOnFocus` nếu thien muốn).

## Ghi chú

- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
