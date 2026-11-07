# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-07 · Claude (thread "Gom và hoàn thiện việc dang dở Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu
Phase 8, hoàn thiện Kaiwa (#234–#238) và nghiên cứu tính năng (#232) đã lên `main`; việc tiếp theo chờ thien chọn. Ba quy
trình thien đặt, xong cái trước mới sang cái sau: (1) chọn tính năng (đang ở đây), (2) luật làm việc lâu dài với Claude,
(3) UI/UX (phác thảo: mục 6 của `docs/plans/2026-11-04-research/00-ke-hoach.md`).

## Đang làm
Chưa có bước nào. Nhận bước nào thì ghi bảng `Bước | Nhánh | Phiên` vào đây trong commit đầu tiên của nhánh.

## Vừa xong
- Nghiên cứu tính năng vòng 2 (#232): `docs/plans/2026-11-04-feature-candidates.md`, chi tiết trong `2026-11-04-research/`.
- Hoàn thiện Kaiwa (#234–#238): link chia sẻ đọc được không cần đăng nhập, thẻ "Đang chia sẻ" / "Từ Kho chung",
  màn hình rộng có danh sách bên phải, menu Thao tác, cỡ chữ 5 mức.

## Đang chờ thien (tối đa 3)
1. **Chọn việc tiếp theo:** trả lời 3 câu ở mục 6 của `docs/plans/2026-11-04-feature-candidates.md`, và xếp thứ tự 4 việc
   Kaiwa còn lại: (a) MCP tìm và lấy kịch bản chung, (b) karaoke theo âm tiết, (c) chọn giọng từng vai, (d) lưu buổi
   nhập vai vào Lịch sử (đổi schema, cần kế hoạch trước).
2. **Thử phase 8 và Kaiwa mới một lượt trên NUC** (khoảng 20 phút): Ôn nhanh, Kho chung và `library_search`/`library_take`,
   chia sẻ kịch bản rồi mở link ở cửa sổ ẩn danh, Lấy về bằng tài khoản thứ hai (`kai`), K8 nhập vai trong claude.ai,
   cỡ chữ và phím ↑ ↓, địa chỉ MCP trong Cài đặt > Hướng dẫn.
3. **Thu hồi token MCP `k9`** (Cài đặt > Tài khoản > Token MCP), xoá `token.txt` trong `C:\FPT_Source\sakubun-backups\kaiwa-k9`.

## Việc nhỏ còn treo
- Trên điện thoại, nút ⋯ của trang kịch bản nằm riêng một hàng để khớp màn hình đang tải; đổi thì đổi cả hai.
- e2e: cả bộ xanh sau #240 (2026-11-07) (CI không chạy e2e, nên chạy tay trước PR đổi UI). Còn một lần đỏ hiếm ở
  `quick-review` "at 390px" (hai nhãn "Thẻ 1 / 4" cùng lúc, chưa tái hiện lại). Gỡ runner `tnt-laptop-wsl` nếu còn. Kế hoạch phase 6 chưa có trong repo.

## Ghi chú
- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
