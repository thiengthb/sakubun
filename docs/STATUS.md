# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-08 · Claude (thread "Gom và hoàn thiện việc dang dở Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

Luyện dịch (R1–R4, kế hoạch đã duyệt) và Kaiwa (c) chọn giọng, (d) lưu nhập vai vào Lịch sử đang lên từng PR. Kanji
(`docs/plans/2026-11-08-kanji.md`, đã duyệt): KJ1 xong, Codex viết nghĩa Việt (KJ1b), Claude làm KJ2–KJ7.

## Đang làm

| Bước                                                                                         | Nhánh                          | Phiên                                           |
| -------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| R1 luyện dịch: mỗi loại một cấp đang học (`docs/plans/2026-11-07-translation-difficulty.md`) | `claude/project-thread-2ogyjr` | thread "Gom và hoàn thiện việc dang dở Sakubun" |
| R2 + R3 luyện dịch: bậc câu 1–5 từ lịch sử ôn, cảnh luân phiên, chặn câu trùng (cùng kế hoạch) | `claude/project-thread-2ogyjr` | thread "Gom và hoàn thiện việc dang dở Sakubun" |

## Vừa xong

- KJ1 #246: dữ liệu kanji 2.136 chữ Jōyō; Codex viết nghĩa Việt theo `docs/codex/2026-11-08-kanji-meanings-brief.md`.
- Kaiwa (a) #243 MCP lấy kịch bản chung, (b) #245 karaoke theo âm tiết; Quản trị hiện lại mục đã ẩn trên Kho chung (#244).

## Đang chờ thien (tối đa 3)

1. **Hiện lại "N5 · Ngữ pháp"**: trang Quản trị, mục "Đã ẩn khỏi Kho chung", bấm Hiện.
2. **Thử chia sẻ kịch bản** trên NUC: chia sẻ, mở link ở cửa sổ ẩn danh, Lấy về bằng tài khoản thứ hai (`kai`). Phần MCP
   (`status`, `library_search`, `library_take`, `kaiwa_list`, `kaiwa_roleplay`) Claude đã thử trên tài khoản thien, chạy đúng.

## Việc nhỏ còn treo

- Trên điện thoại, nút ⋯ của trang kịch bản nằm riêng một hàng để khớp màn hình đang tải; đổi thì đổi cả hai.
- e2e không chạy trong CI, chạy tay trước PR đổi UI; còn một lần đỏ hiếm ở `quick-review` "at 390px" (chưa tái hiện).

## Ghi chú

- thien là người học (thi N2 tháng 12/2026, yếu nghe và nói): mục 1 của `docs/plans/2026-11-04-feature-candidates.md`.
- NUC tự cập nhật khi `main` xanh CI (`nuc-infra/runbooks/02-add-app.md`); kéo tay cần `sudo`. Log:
  `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`. Trần tài khoản: `MAX_ACCOUNTS` (mặc định 50).
