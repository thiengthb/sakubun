# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-11-07 (bàn giao sang tài khoản Claude khác; đợt hoàn thiện Kaiwa #234–#238 đã merge).

## Đang làm

Không có bước nào đang làm (bàn giao 2026-11-07). Đợt "hoàn thiện Kaiwa" đã merge hết, xem mục 12 bên dưới.
Phiên mới: hỏi thien chọn việc Kaiwa nào làm tiếp (danh sách ở mục 12), ghi bước vào đây trước khi code.

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
- Đóng PR #231 (bản K7b làm trùng với #229 đã merge; Claude không đóng được vì bị chặn quyền).
- Thử Kaiwa mới (#234–#238, merge 2026-11-07): chia sẻ một kịch bản (menu Thao tác › Chia sẻ › Chép đường dẫn), mở link ở cửa sổ ẩn danh (đọc được khi chưa đăng nhập, "Đăng nhập để lấy về" quay lại đúng bài), rồi bằng tài khoản thứ hai (`kai`) Lấy về; trên laptop ≥1280px bấm Hội thoại mở bài gần nhất, cột danh sách bên phải; phím + và − đổi cỡ chữ; ↑ ↓ đưa câu ra giữa màn hình.
- Thử nhập vai (K8) trong claude.ai: mở một kịch bản có từ hai vai, bấm "Nhập vai với AI", dán câu vào claude.ai.
- Thu hồi token MCP `k9` (Cài đặt > Tài khoản > Token MCP) và xoá `token.txt` trong `C:\FPT_Source\sakubun-backups\kaiwa-k9` trên laptop: chỉ dùng để nhập K9.
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
   giới thiệu, không có nút "Đoán"). Xong: C1a #170, C3 #171, 50 câu mẫu #172, C2 #173, 250 mục #174, C4 #175, C5a #176, C5b #177; C1b Codex dịch xong cả bộ #213–#220 (2026-10-29).
7. 7.4 (làm lại UI) xong 2026-10-28: kế hoạch `docs/plans/2026-10-28-ui-kaiwa-library.md` (từ PR #180), 7.4a #181,
   7.4k #182, 7.4b #188, 7.4c #191, 7.4d #192, 7.4e #193, 7.4f #194, 7.4g #195, 7.4h #196, 7.4i #197, #206, #210
   (#207 merge nhầm vào nhánh xếp chồng nên đưa lại qua #210); 7.4j: #198, #199, #203, #204, #208, #209; trang lỗi
   toàn app theo style mới #201.
8. K9 xong 2026-10-31: 5 kịch bản kaiwa-canvas cũ (scripts.json trong bản lưu laptop; Yjs không có bản mới hơn) lưu vào
   Hội thoại của thien qua `kaiwa_save`, không đổi code. 11 bản chỉ còn trong Yjs (đã xoá trên app cũ) thien chọn không
   nhập; còn trong `kaiwa-k9\yjs-orphans.json` trên laptop. Kaiwa còn lại theo thứ tự thien chọn: K6, K8, K7.
9. K6 xong 2026-10-31 (`docs/plans/2026-10-31-k6-kaiwa-listening.md`): cache file âm thanh VOICEVOX trên server #222,
   mỗi vai một giọng #223, "Nghe cả bài" (che câu thì chờ người học nói trước) #224. Karaoke theo âm tiết để sau.
10. K8 xong phần code 2026-10-31 (`docs/plans/2026-10-31-k8-kaiwa-roleplay.md`): tool `kaiwa_roleplay` #225, nút
    "Nhập vai với AI" trên trang kịch bản #226. Còn: thien thử nhập vai thật trong claude.ai.
11. K7 xong phần code 2026-11-04 (`docs/plans/2026-10-31-k7-kaiwa-library.md`): schema và logic #227, giao diện #229
    (nút Chia sẻ trên trang kịch bản, tab Kịch bản trên Kho chung, trang `/library/script/[id]`, Lấy về).
12. Hoàn thiện Kaiwa 2026-11-07 (thien: chia sẻ trước, rồi giao diện), đã merge: #234 ai có link cũng đọc được kịch bản
    đã chia sẻ (thien chọn không cần đăng nhập; khách không nghe máy đọc, không tra từ, trang `noindex`), `/login?next=`
    quay lại đúng trang (`lib/auth/login-return.ts`), nút Chép đường dẫn; #235 thẻ Hội thoại ghi "Đang chia sẻ" /
    "Từ Kho chung"; #236 từ 1280px Hội thoại mở bài đọc gần nhất (nhớ theo máy, `localStorage`), danh sách một cột bên
    phải (`KaiwaSideList`); #237 menu Thao tác gom Sửa, Sửa với AI, Nhập vai với AI, Chia sẻ, Phím tắt (Tôi là, Nghe cả
    bài, Ẩn nghĩa, Che câu vẫn ở ngoài), ↑ ↓ đưa câu ra giữa màn hình; #238 cỡ chữ hội thoại 5 mức 100–175% (phím + và −,
    không Ctrl theo thien; nhớ theo máy). **Còn lại, thien chọn thứ tự**: (a) MCP `library_search`/`library_take` cho
    kịch bản chung (hiện trả lỗi bảo lấy trên web), (b) karaoke theo âm tiết (K6 để sau), (c) chọn giọng cho từng vai,
    (d) lưu buổi nhập vai vào Lịch sử (đổi schema, cần kế hoạch trước).

## Việc nhỏ còn treo

- Trên điện thoại, trang kịch bản có nút ⋯ (Thao tác) nằm riêng một hàng dài dưới tiêu đề: giữ vậy để màn hình đang tải (`app/kaiwa/[id]/loading.tsx`) khớp cả chế độ xem lẫn chế độ sửa (`e2e/skeleton.spec.ts`). Nếu thien thấy vướng thì đổi cả hai cùng lúc.
- e2e `kaiwa.spec.ts` "line by line" chỉ đỏ khi chạy với `SCREENSHOT_DIR` (cả trên `main` trước đợt này); chạy thường thì xanh.

- e2e `quick-review` "by keyboard" lúc xanh lúc đỏ trên `main` (đỏ 3 trong 4 lần, 2026-10-28): câu trả lời không bị chặn mạng như test muốn. 2026-11-04 không tái hiện được (17 lần chạy đều xanh, riêng lẻ và cả file); chưa sửa, nếu đỏ lại thì ghi lại cách chạy.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
