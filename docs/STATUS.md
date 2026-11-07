# Trạng thái hiện tại

Trang này trả lời ba câu cho bất kỳ phiên Claude nào (kể cả từ tài khoản khác): **đang làm gì, ai đang giữ,
việc tiếp theo là gì**. Cập nhật nó **trong cùng PR** với việc làm, và khi nhận một bước mới (xem
"Bắt đầu phiên" trong `CLAUDE.md`). Lộ trình đầy đủ: `docs/roadmap.md`. Kế hoạch đã duyệt: `docs/plans/`.

Cập nhật lần cuối: 2026-11-07 (hoàn thiện Kaiwa: chia sẻ, bố cục màn hình lớn, menu, cỡ chữ; bàn giao nghiên cứu tính năng, PR #232).

## Đang làm

| Bước | Nhánh | Phiên |
|---|---|---|
| Hoàn thiện Kaiwa (thien, 2026-11-07). Mở PR, chờ thien merge theo thứ tự #234 → #235 → #236 → #237 → #238 (xếp chồng): #234 ai có link cũng đọc được kịch bản đã chia sẻ (thien chọn không cần đăng nhập) và đăng nhập xong về đúng trang; #235 thẻ Hội thoại ghi "Đang chia sẻ" / "Từ Kho chung"; #236 từ 1280px mở bài đọc gần nhất, danh sách một cột bên phải; #237 nút gom vào menu Thao tác, ↑ ↓ đưa câu ra giữa màn hình; #238 cỡ chữ hội thoại 5 mức (phím + và −, không Ctrl, theo thien), nhớ theo từng máy. Còn lại để thien chọn thứ tự: MCP tìm và lấy kịch bản chung, karaoke theo âm tiết, chọn giọng từng vai, lưu buổi nhập vai. | `feat/kaiwa-text-size` (và các nhánh dưới) | thread "Hoàn thiện Kaiwa, ưu tiên chia sẻ hội thoại" |
| Quy trình 1: nghiên cứu học ngôn ngữ và ứng cử viên tính năng. Bản nháp vòng 2 xong, **chờ thien duyệt** (PR #232, chỉ có tài liệu, risk:high, thien merge). Bàn giao 2026-11-07: phiên cũ dừng, tài khoản mới nhận tiếp (xem "Bàn giao nghiên cứu" bên dưới). | `docs/2026-11-04-research` | thread "Nghiên cứu và đề xuất tính năng Sakubun" (đã dừng; ai nhận thì ghi tên phiên vào đây) |

### Bàn giao nghiên cứu (2026-11-07)

thien đặt ra ba quy trình dài, làm theo thứ tự, mỗi quy trình chỉ bắt đầu khi thien đồng ý quy trình trước:

1. **Nghiên cứu và chọn tính năng** (đang ở đây). Kế hoạch và nghiên cứu: `docs/plans/2026-11-04-research/`
   (`00-ke-hoach.md`, A SLA, B trí nhớ, C thói quen, D đa giác quan, E đối thủ, F Việt–Nhật, G nguồn dữ liệu,
   H phản biện app). Danh sách ứng cử viên vòng 2 (đã tính 8 câu trả lời của thien, có bảng ở mục 1):
   `docs/plans/2026-11-04-feature-candidates.md`. Việc còn lại: thien trả lời 3 câu ở mục 6 của file đó
   (vòng dịch "chưa ổn" ở đâu, có muốn kế hoạch N2 cấp tốc 4 tuần không, có cần viết tay kanji không), phản biện,
   duyệt danh sách cuối; sửa file theo đó rồi để thien merge #232. Mỗi đợt tính năng sau đó có kế hoạch riêng.
2. **Luật làm việc lâu dài giữa thien và Claude**: tiếng Việt tự nhiên, không mù mờ; mỗi đề xuất có phản biện; khi
   nào hỏi, khi nào tự làm; mẫu đầu ra. Phác thảo ở mục 6 của `00-ke-hoach.md`. Chưa bắt đầu.
3. **Mổ xẻ UI/UX và hệ thống style**: kiểm từng trang (Nielsen, WCAG 2.2, `docs/ui-standard.md`), thử bằng nhiệm vụ
   thật, nghiên cứu style rồi ra token, component, kế hoạch từng PR. Phác thảo ở mục 6 của `00-ke-hoach.md`. Chưa bắt đầu.

Điều cần biết về thien với tư cách người học (2026-11-04): N3 tháng 7/2026 117/180 (ngôn ngữ 48, đọc 34, nghe 35),
thi **N2 tháng 12/2026**; yếu nhất nghe và nói; học theo hứng, dùng Anki và Quizlet; thích luyện dịch và học đa giác
quan; muốn nhiều người Việt dùng (có thể thu phí); **không đưa AI vào web** khi chưa có chiến lược kinh doanh; không có
dữ liệu nào bắt buộc giữ.

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
- Thử K7: chia sẻ một kịch bản (nút Chia sẻ cạnh tiêu đề), rồi bằng tài khoản thứ hai (`kai`) mở Kho chung › Kịch bản và Lấy về.
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

## Việc nhỏ còn treo

- e2e `quick-review` "by keyboard" lúc xanh lúc đỏ trên `main` (đỏ 3 trong 4 lần, 2026-10-28): câu trả lời không bị chặn mạng như test muốn. 2026-11-04 không tái hiện được (17 lần chạy đều xanh, riêng lẻ và cả file); chưa sửa, nếu đỏ lại thì ghi lại cách chạy.
- Kế hoạch phase 6 (UI redo, các bước 6.x như PR #128 "6.9") chưa có trong repo; chỉ còn dấu vết trong
  commit và PR. Nếu còn bước 6.x chưa làm, chép kế hoạch vào `docs/plans/`.
- Repo public từ 2026-10-27; CI về lại runner của GitHub (#135, `docs/ci-runner.md`). Không dùng runner tự host khi
  repo public; runner `tnt-laptop-wsl` trên laptop đã dừng.
