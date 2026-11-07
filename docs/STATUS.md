# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-07 · Claude (thread "Xây bộ luật làm việc người–AI chung", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng.

## Đang ở đâu
Phase 8 và đợt hoàn thiện Kaiwa đã lên `main` (#234–#238). Ba quy trình thien đặt, làm theo thứ tự, xong cái trước mới
sang cái sau: (1) chọn tính năng (đang chờ duyệt, #232), (2) luật làm việc lâu dài với Claude, (3) UI/UX.

## Đang làm
| Bước | Nhánh | Phiên |
|---|---|---|
| Nghiên cứu tính năng, bản nháp vòng 2, chờ thien (#232, risk:high, thien merge) | `docs/2026-11-04-research` | phiên cũ đã dừng 7/11; ai nhận thì ghi tên phiên vào đây |

## Vừa xong
- Hoàn thiện Kaiwa (#234–#238): link chia sẻ đọc được không cần đăng nhập, thẻ "Đang chia sẻ" / "Từ Kho chung",
  màn hình rộng có danh sách bên phải, menu Thao tác, cỡ chữ 5 mức.

## Đang chờ thien (tối đa 3)
1. **Chọn việc tiếp theo:** trả lời 3 câu ở mục 6 của `docs/plans/2026-11-04-feature-candidates.md` (trên nhánh #232) rồi
   duyệt danh sách. Cùng lúc xếp thứ tự 4 việc Kaiwa còn lại: MCP tìm và lấy kịch bản chung, karaoke theo âm tiết,
   chọn giọng từng vai, lưu buổi nhập vai.
2. **Thử phase 8 và Kaiwa mới một lượt trên NUC** (khoảng 20 phút): Ôn nhanh, Kho chung và `library_search`/`library_take`,
   link chia sẻ khi chưa đăng nhập, K7 bằng tài khoản thứ hai (`kai`), K8 nhập vai trong claude.ai, địa chỉ MCP trong
   Cài đặt > Hướng dẫn.
3. **Thu hồi token MCP `k9`** (Cài đặt > Tài khoản > Token MCP), xoá `token.txt` trong `C:\FPT_Source\sakubun-backups\kaiwa-k9`.

## Việc nhỏ còn treo
- PR #231 là một bản K7b làm song song với #229; #229 đã merge nên #231 có lẽ đóng được. thien xem rồi quyết.
- e2e `quick-review` "by keyboard" từng đỏ 3/4 lần (28/10); 4/11 chạy 17 lần đều xanh. Đỏ lại thì ghi cách chạy.
- Gỡ runner `tnt-laptop-wsl` khỏi repo nếu còn; repo public nên chỉ dùng runner của GitHub (`docs/ci-runner.md`).
- Kế hoạch phase 6 (các bước 6.x) chưa có trong repo; nếu còn bước chưa làm thì chép vào `docs/plans/`.

## Ghi chú
- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
