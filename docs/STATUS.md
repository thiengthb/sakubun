# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-13 · Claude (thread "Đọc bàn giao và làm tiếp Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

Luyện dịch R1–R4, Kaiwa (a)–(d), kanji KJ1–KJ7 đã xong. UI v2 (`docs/plans/2026-11-08-ui-v2.md`): U0 và U1 xong (khung app
Base UI, sidebar 3 nhóm, thanh 5 tab là điều hướng duy nhất trên điện thoại, `/progress`, Cài đặt tự lưu; #276–#287).
Phân tích vẫn ở `/`: Tổng quan và Thống kê vào Tiến độ ở U7, Hôm nay thay `/` ở U3.

## Đang làm

| Bước                                                       | Nhánh                         | Phiên                                                           |
| ---------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| U2 Phiên học (`docs/plans/2026-11-13-u2-study-session.md`) | `feat/u2a-…` đến `feat/u2f-…` | Claude, thread "Làm lại màn phiên ôn (U2)", tài khoản của thien |

U1 xong 13/11 (thien bỏ bước thử trên điện thoại). U2a–U2d làm trước; U2e (ghi điểm chạy nền) và U2f (hoàn tác) chờ
thien duyệt mục "Cần bạn chọn" của kế hoạch U2.

## Đang chờ thien (tối đa 3)

1. **Hiện lại "N5 · Ngữ pháp"**: trang Quản trị, mục "Đã ẩn khỏi Kho chung", bấm Hiện.
2. **Thử chia sẻ kịch bản** trên NUC: chia sẻ, mở link ở cửa sổ ẩn danh, Lấy về bằng tài khoản thứ hai (`kai`); phần MCP Claude đã thử, chạy đúng.

## Việc nhỏ còn treo

- Trên điện thoại, nút ⋯ của trang kịch bản nằm riêng một hàng để khớp màn hình đang tải; đổi thì đổi cả hai.
- e2e không chạy trong CI, chạy tay trước PR đổi UI; `style-audit` đỏ trên main khi chạy sau kaiwa/quick-review (cần PR riêng);
  `quick-review` "lost answer" đỏ tuỳ thứ tự, chạy riêng thì xanh. Tabs Base UI không tự chọn khi di phím (thêm `activateOnFocus` nếu thien muốn).

## Ghi chú

- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
