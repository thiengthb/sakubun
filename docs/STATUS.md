# Trạng thái hiện tại

Cập nhật lần cuối: 2026-11-08 · Claude (thread "Gom và hoàn thiện việc dang dở Sakubun", tài khoản của thien)

Trang này cho mọi phiên (kể cả tài khoản, model khác) biết trong 2 phút: đang ở đâu, ai giữ việc gì, cần thien làm gì.
Lịch sử nằm trong git, PR và `docs/roadmap.md`, không ghi ở đây. Cả file dưới 40 dòng; quá thì gộp hoặc bỏ, đừng thêm.

## Đang ở đâu

Luyện dịch R1–R4 và Kaiwa (a)–(d) đã xong. Kanji (`docs/plans/2026-11-08-kanji.md`, đã duyệt): KJ1 và
nghĩa Việt (KJ1b) xong; KJ2–KJ5 xong (#260–#263); KJ6 ở PR; KJ7 đã làm xong, mở PR sau.

## Đang làm

| Bước                                              | Nhánh                          | Phiên                                           |
| ------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| KJ6: trang một chữ kanji với mạng lưới thành phần | `claude/project-thread-2ogyjr` | thread "Gom và hoàn thiện việc dang dở Sakubun" |

## Vừa xong

- R1 #247: mỗi loại một cấp đang học (#248 sửa lỗi bấm あ làm cài đặt về mặc định). R2 + R3 #249: bậc câu 1–5, cảnh luân phiên, chặn câu trùng. R4 #255, #257: khối kết quả mỗi lượt.
- Kaiwa (a) #243, (b) #245, (c) #258 giọng từng vai, (d) #259 lưu nhập vai vào Lịch sử; Kho chung #244. KJ1 #246: dữ liệu kanji 2.136 chữ Jōyō; nghĩa Việt cả 2.136 chữ do Codex viết (#250–#256).

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
