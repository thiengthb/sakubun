# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-28 (7.4a #181, 7.4k #182, 7.4b #188, 7.4c #191, 7.4d #192, 7.4e #193, 7.4f #194, 7.4g #195 xong; 7.4h #196 mở PR).

## Đang làm

| Bước                                                                                                                          | Nhánh / PR                        | Giữ bởi             | Trạng thái                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.4h Kho chung tab Nhóm (bảng OpenJLPT theo cấp có "Đã có x/y", Cộng đồng) và trang nhóm (tìm trong nhóm, Lấy phần còn thiếu) | `feat/7.4h-library-groups` (#196) | Claude (thread 7.4) | PR mở, chờ thien merge (risk:high: đổi Kho chung). Thẻ từng mục giữ nguyên tới 7.4i                                                                     |
| Trang lỗi gốc theo style chung (thien thấy chữ kiểu Times)                                                                    | `fix/7.4-standalone-pages-style`  | Claude (thread 7.4) | PR mở, chờ thien merge (risk:high: đổi UI). Dò cả trang đăng nhập, đồng ý OAuth, 404, lỗi, chính sách: chỉ trang lỗi gốc lệch.                          |
| 8 C1b dịch câu ví dụ (cả bộ, mỗi PR khoảng 1.000 mục)                                                                         | `codex/openjlpt-*`                | Codex (thien giao)  | 50 câu mẫu (#172), đợt 1: 250 mục (#174); thien giao dịch hết phần còn lại 2026-10-28; mỗi đợt một nhánh mới từ `main`, Claude kiểm và merge (risk:low) |

## Chờ thien

NUC tự cập nhật sakubun: `main` xanh CI thì `deploy.yml` đẩy image lên ghcr; poller trên miniserver (2 phút, chỉ app có
`/opt/apps/sakubun/.autodeploy`) chụp DB (`.snapshot`), kéo bản mới, chạy migration lúc khởi động, kiểm healthy; hỏng thì
tự quay về bản cũ và đổi thành `.autodeploy.blocked` (`nuc-infra/runbooks/02-add-app.md`). Bị khoá từ 2026-10-27 14:27 UTC
(lỗi migrate trong image, sửa ở #169); bật lại 2026-10-28, lần chạy 07:40 UTC `deploy healthy`. Kéo tay phải dùng quyền của
poller (`sudo`), user `thi3n` không có token ghcr. Xem log: `journalctl -u miniserver-deploy-poll --since "-10 min" | grep sakubun`.

- Thử Ôn nhanh mới (#171–#177, đã lên NUC 2026-10-28): Ôn nhanh với mục mới (thẻ giới thiệu, nút "Đã xem"), và trong claude.ai nhờ Claude thêm câu ví dụ cho một mục (`example_add`).
- Thử Kho chung (#159–#167, đã lên NUC): `/library`, và
  `library_search`, `library_take` trong claude.ai (L5).
- Thử Kaiwa (#156, đã lên NUC) trong claude.ai: nhờ Claude soạn một đoạn hội thoại ngắn trên canvas, lưu, mở đường dẫn nó trả về; trên web thử chọn vai "Tôi là", rê chuột xem nghĩa, Thêm và Sửa.
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
4. Kaiwa sơ bộ xong 2026-10-27: K1 #151, K2 #152, rồi K3, K4, K3b (thẻ kiểu tin nhắn, vai "Tôi là" bên trái),
   K3c (sửa và tạo trên web) và K5 (rê chuột xem nghĩa) cùng lên `main` qua #156 (#153–#155, #157 merge vào nhánh
   xếp chồng). Giao diện Kaiwa còn thô, làm đẹp trong 7.4.
5. Kho chung L1–L6 xong, lên `main` 2026-10-28: L1a #159, L1b #160, L2 #161, L3a #162, L3b #163, L4 #164, L5 #165,
   L6a #166, L6b #167.
6. Ôn nhanh (C): kế hoạch `docs/plans/2026-10-28-quick-review.md` duyệt 2026-10-28 (Codex dịch câu ví dụ, mục mới là thẻ
   giới thiệu, không có nút "Đoán"). Xong: C1a #170, C3 #171, 50 câu mẫu #172, C2 #173, 250 mục #174, C4 #175, C5a #176, C5b #177. Còn: C1b (Codex dịch phần còn lại). Tiếp theo 7.4
   (làm lại UI, cùng các lỗi nhỏ bên dưới), rồi K6–K9.

## Việc nhỏ còn treo

- Trang đồng ý OAuth ("Cho phép truy cập Sakubun?") không ghi đang cấp quyền cho tài khoản nào; trình duyệt đang
  đăng nhập sakubun bằng tài khoản khác thì connector âm thầm nối sai tài khoản (thử thật 2026-10-27). Nên hiện email
  trên trang đó (đụng OAuth, risk:high).
- Liên kết OAuth hỏng (vd `redirect_uri` lạ) đưa về `/login?error=invalid_redirect`, và trang đăng nhập ghi "Tài khoản này
  không được phép vào Sakubun" cho mọi mã lỗi: sai nghĩa, nên nói liên kết kết nối không hợp lệ (`onAPIError` trong
  `lib/auth/auth.ts`, `app/login/login-form.tsx`; đụng OAuth, risk:high; thấy 2026-10-28).
- e2e `skeleton` ở 390px: khung chờ trang một mục thấp hơn trang thật 44px (hàng nút đầu trang trên điện thoại); đỏ cả trên `main` (thấy 2026-10-28, sau 7.4k).
- e2e `critical-path` chờ "Chưa có gì để học", nhưng Phân tích nay ghi "Kho của bạn còn trống": đỏ cả khi chạy riêng (thấy 2026-10-28).
- e2e `quick-review` "by keyboard" lúc xanh lúc đỏ trên `main` (đỏ 3 trong 4 lần, 2026-10-28): câu trả lời không bị chặn mạng như test muốn.
- e2e `header-actions` "on a phone" tìm nút Bộ lọc ở Tài nguyên, nhưng khi DB e2e trống (spec khác vừa xoá mục) thì trang chỉ có trạng thái trống, không có nút lọc: phụ thuộc dữ liệu spec khác để lại (thấy 2026-10-28).
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- `recordReviews` chưa gọi `invalidateStreak` sau mỗi lần ôn, nên chuỗi ngày có thể hiện chậm tới 60 giây
  (`lib/insights/streak.ts`; cache giờ theo từng người học).
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
