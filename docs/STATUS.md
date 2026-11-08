# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-07 · Claude (thread "Gom và hoàn thiện việc dang dở Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

thien đã chọn (2026-11-07): không làm kế hoạch cấp tốc N2; có làm kanji (học tiếng Nhật nói chung); Kaiwa làm theo thứ tự
(a) MCP tìm và lấy kịch bản chung, (b) karaoke theo âm tiết, (c) chọn giọng từng vai, (d) lưu buổi nhập vai vào Lịch sử
(cần kế hoạch). Luyện dịch với AI (độ khó tăng dần, đáp án tham khảo, cấp độ từ vựng) có kế hoạch riêng chờ thien duyệt.

## Đang làm

| Bước                                                         | Nhánh                          | Phiên                                           |
| ------------------------------------------------------------ | ------------------------------ | ----------------------------------------------- |
| KJ1: dữ liệu kanji (`data/kanji/`, `scripts/kanji/build.py`) | `claude/project-thread-2ogyjr` | thread "Gom và hoàn thiện việc dang dở Sakubun" |

## Vừa xong

- Kaiwa (b) #245: karaoke sáng theo từng âm tiết của giọng VOICEVOX.
- Quản trị hiện lại mục đã ẩn trên Kho chung, cả nhóm OpenJLPT (#244).
- Kaiwa (a) #243: `library_search`/`library_take` tìm và lấy kịch bản chung.
- Nghiên cứu tính năng vòng 2 (#232): `docs/plans/2026-11-04-feature-candidates.md`, chi tiết trong `2026-11-04-research/`.
- Hoàn thiện Kaiwa (#234–#238): link chia sẻ đọc được không cần đăng nhập, thẻ "Đang chia sẻ" / "Từ Kho chung",
  màn hình rộng có danh sách bên phải, menu Thao tác, cỡ chữ 5 mức.

## Đang chờ thien (tối đa 3)

1. **Duyệt kế hoạch luyện dịch** (độ khó tăng dần, đáp án tham khảo, cấp độ từ vựng): 4 câu hỏi cuối kế hoạch.
2. **Thử chia sẻ kịch bản** trên NUC: chia sẻ, mở link ở cửa sổ ẩn danh, Lấy về bằng tài khoản thứ hai (`kai`). Phần MCP
   (`status`, `library_search`, `library_take`, `kaiwa_list`, `kaiwa_roleplay`) Claude đã thử trên tài khoản thien, chạy đúng.

## Việc nhỏ còn treo

- Trên điện thoại, nút ⋯ của trang kịch bản nằm riêng một hàng để khớp màn hình đang tải; đổi thì đổi cả hai.
- e2e: cả bộ xanh sau #240 (2026-11-07) (CI không chạy e2e, nên chạy tay trước PR đổi UI). Còn một lần đỏ hiếm ở
  `quick-review` "at 390px" (hai nhãn "Thẻ 1 / 4" cùng lúc, chưa tái hiện lại). Gỡ runner `tnt-laptop-wsl` nếu còn. Kế hoạch phase 6 chưa có trong repo.

## Ghi chú

- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
