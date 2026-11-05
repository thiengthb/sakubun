# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-05 · Claude (thread "Xây bộ luật làm việc người–AI chung", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng.

## Đang ở đâu
Lộ trình phase 8 đã xong phần code. Đang nghiên cứu tính năng cho chặng tiếp theo (PR #232, bản nháp, chờ thien).

## Đang làm
| Bước | Nhánh | Phiên |
|---|---|---|
| Nghiên cứu học ngôn ngữ và ứng cử viên tính năng | `docs/2026-11-04-research` (#232) | thread "Nghiên cứu và đề xuất tính năng Sakubun" |

## Vừa xong
- K7 phần code: chia sẻ và lấy kịch bản Kaiwa trên Kho chung (#227, #229).
- K8 phần code: nhập vai với AI (#225, #226). K6 nghe cả bài (#222–#224). Sửa e2e trên điện thoại (#230).

## Đang chờ thien (tối đa 3)
1. **Duyệt nghiên cứu tính năng:** trả lời 8 câu hỏi trong `00-ke-hoach.md` của PR #232. Mọi việc tiếp theo chờ cái này.
2. **Thử phase 8 một lượt trên NUC** (khoảng 20 phút): Ôn nhanh mới, Kho chung và `library_search`/`library_take`,
   Kaiwa, K7 bằng tài khoản thứ hai (`kai`), K8 nhập vai trong claude.ai, địa chỉ MCP trong Cài đặt > Hướng dẫn.
   Bước nào còn chờ thử thì cột Status của `docs/roadmap.md` ghi rõ.
3. **Thu hồi token MCP `k9`** (Cài đặt > Tài khoản > Token MCP) và xoá `token.txt` trong
   `C:\FPT_Source\sakubun-backups\kaiwa-k9` trên laptop. Token chỉ dùng để nhập K9, để lâu là rủi ro.

## Việc tiếp theo
1. Sau khi thien duyệt #232: viết kế hoạch cho đợt tính năng đầu tiên vào `docs/plans/`.

## Việc nhỏ còn treo
- PR #231 là một bản K7b làm song song với #229; #229 đã merge nên #231 có lẽ đóng được. thien xem rồi quyết.
- e2e `quick-review` "by keyboard" từng đỏ 3/4 lần (2026-10-28); 2026-11-04 chạy 17 lần đều xanh. Đỏ lại thì ghi cách chạy.
- Gỡ runner `tnt-laptop-wsl` khỏi repo nếu còn (Settings > Actions > Runners); repo public nên chỉ dùng runner của GitHub (`docs/ci-runner.md`).
- Kế hoạch phase 6 (các bước 6.x) chưa có trong repo; nếu còn bước chưa làm thì chép vào `docs/plans/`.

## Ghi chú vận hành
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`). Kéo tay cần `sudo` vì user `thi3n` không có token
  ghcr. Log: `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
