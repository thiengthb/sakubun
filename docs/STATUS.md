# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-09 11:30 UTC · Claude (thread "Làm lại UI/UX v2", bàn giao vì hết usage tuần)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

Luyện dịch R1–R4, Kaiwa (a)–(d), kanji KJ1–KJ7 đã xong. UI v2 (`docs/plans/2026-11-08-ui-v2.md`): U0 xong và thien đã duyệt
ảnh. U1 (khung app) đang làm: #276–#282 đưa mọi `components/ui` sang Base UI và bỏ `radix-ui`; #283 sidebar 3 nhóm
Học/Kho/Bạn + menu tài khoản đã merge; PR thanh 5 tab trên điện thoại (PR này) chờ review. Phiên giữ U1 đã bàn giao: phiên nào cũng nhận được.

## U1 còn lại (theo thứ tự)

1. PR thanh 5 tab trên điện thoại + số thẻ đến hạn ở Ôn nhanh (B2), bỏ `edge-nav-rail` (risk:medium): merge khi review OK, CI xanh.
2. Lịch sử thành Tiến độ ở `/progress`, `/history` chuyển hướng: đã code, verify và e2e xanh, nằm ở patch
   `/mnt/project-files/sakubun/pending-patches/u1/0002-*.patch`; `git am` lên main sau bước 1, một PR risk:medium.
   Không thấy thư mục đó thì làm lại theo mục U1 của kế hoạch.
3. Cổng U1: thien duyệt ảnh trên https://claude.ai/artifact/TedjKZtwMf2QQhZ5msNexj (15 cặp trước/sau) và đi thử 5 tab trên điện thoại thật.

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
