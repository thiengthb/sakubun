# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-10-28 (Kho chung L1–L6 đã lên `main`, #159–#167; kế hoạch Ôn nhanh đã duyệt).

## Đang làm

| Bước | Nhánh / PR | Giữ bởi | Trạng thái |
| --- | --- | --- | --- |
| 8 C3 Ôn nhanh công bằng hơn: nhiễu cùng từ loại hoặc cách nối từ cả kho OpenJLPT, bỏ nhãn tiếng Anh, hạt giống theo lần ôn, làm lại câu sai cuối buổi | `feat/8-c3-fair-cloze` | Claude (phiên của thien, 2026-10-28) | PR mở (risk:high, thien merge) |
| 8 C1b dịch câu ví dụ (50 câu mẫu trước, rồi cả bộ) | `data/openjlpt-examples-*` | Codex (thien giao) | chờ Codex: 50 câu mẫu trước |

## Chờ thien

- C1a đã merge (#170): giao Codex bản `docs/codex/2026-10-28-examples-brief.md` (C1b), duyệt 50 câu mẫu Codex gửi.
- Đưa bản có Kho chung (#159–#167, thêm bảng mới) lên NUC: sao lưu DB trước. Rồi thử `/library`, và
  `library_search`, `library_take` trong claude.ai (L5).
- Đưa bản có Kaiwa (#156, thêm bảng `Script` và cột `Script.analysis`) lên NUC: sao lưu DB trước. Rồi thử trong claude.ai: nhờ Claude soạn một đoạn hội thoại ngắn trên canvas, lưu, mở đường dẫn nó trả về; trên web thử chọn vai "Tôi là", rê chuột xem nghĩa, Thêm và Sửa.
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
   giới thiệu, không có nút "Đoán"); làm C1a–C5. Sau đó 7.4
   (làm lại UI, cùng các lỗi nhỏ bên dưới), rồi K6–K9.

## Việc nhỏ còn treo

- Trang đồng ý OAuth ("Cho phép truy cập Sakubun?") không ghi đang cấp quyền cho tài khoản nào; trình duyệt đang
  đăng nhập sakubun bằng tài khoản khác thì connector âm thầm nối sai tài khoản (thử thật 2026-10-27). Nên hiện email
  trên trang đó (đụng OAuth, risk:high).
- Lượt thử 2026-10-27: Claude đọc kết quả `status` thành "18 mục đến hạn, 100 lượt ôn" trong khi đó là hạn mức ngày
  (tài khoản mới có 0 đến hạn). Cần làm chữ của `status` rõ hơn giữa "đến hạn" và "hạn mức".
- e2e `critical-path` chờ "Chưa có gì để học" nhưng fail khi chạy chung DB với spec khác đã thêm dữ liệu.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- `recordReviews` chưa gọi `invalidateStreak` sau mỗi lần ôn, nên chuỗi ngày có thể hiện chậm tới 60 giây
  (`lib/insights/streak.ts`; cache giờ theo từng người học).
- Chữ "Xóa" và "Xoá" dùng lẫn lộn trong UI; chọn một cách viết (repo đang dùng "Xoá" trong tài liệu).
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
