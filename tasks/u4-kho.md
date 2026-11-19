# U4: màn Kho theo cấp JLPT (U4d lấy thêm tại chỗ chờ duyệt)

Repo: thiengthb/sakubun · Nhánh: feat/u4d-take-in-place · PR: #335
Ghi bởi: Claude tnt628, https://claude.ai/code/project/chan_0145cotX9neLQKZjxfBxCwDe?thread=cmsg_0145cotX9neLQKZjxfBxCwDe2nQVyXHabhp85BNJRRHSxc · Cập nhật: 2026-11-19T03:42Z

## thien muốn gì
Làm U4 theo kế hoạch đã duyệt `docs/plans/2026-11-14-u4-kho.md` (hướng 2, gộp theo cấp JLPT; 15/11 thien trả lời "theo đề xuất" cả 3 câu, U4g/U4h để sau kỳ thi N2). thien bảo nick tnt697 làm tiếp ("nick này làm tiếp", 15/11).

## Đã xong
- Kế hoạch: PR #313. U4a số theo cấp: #322. U4b bảng cấp: #323 (merge 18/11).
- U4c bố cục: vòng 1 bị bác; vòng 2 thien chọn A và duyệt bản gộp (18/11), ghi trong kế hoạch mục "U4c (15/11)", ảnh `u4c-r2/combo-*.jpg`.
- U4c1 logic chia chặng: #325 (merge 18/11), `lib/library/level-sets.ts`, `lib/app/level-sets.ts`.

## Bước tiếp theo
1. U4d (lấy thêm tại chỗ), PR nháp #335, nhánh feat/u4d-take-in-place (6eb0834): code, test, e2e xong. thien OK cả 7 ảnh (19/11 03:27Z); PR đã sẵn sàng, risk:medium, đã nhờ coordinator mở thread review. Chờ CodeRabbit (sửa từng ý), review, rồi thien nói "merge đi".
2. Rồi U4e (Ngoài JLPT và nút Thêm), U4f (ô tìm hai nguồn) theo kế hoạch.

## Đang chờ thien
- Duyệt ảnh U4d: https://claude.ai/artifact/BZnmJcZP4MFXtL9tmcx14p (mở ở nick tnt628). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4d/round.json <out>` (ảnh trong nhánh). Spec chụp tạm không commit.

## Lưu ý
- Máy ảo: `npm ci` cần `npm_config_nodedir=/opt/node22`; `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`; e2e chạy bằng Chrome hệ thống (config tạm với `channel: 'chrome'`, không commit). `npm run build` lỗi ở máy ảo vì không tải được Google Fonts, CI thì xanh.
- `lib/insights/dashboard-model.test.ts` đỏ ở máy ảo cả trên main (không phải lỗi của U4), CI xanh.
- 18/11 14:50Z: U4c3 (màn chặng) ở PR nháp #332, nhánh feat/u4c3-set-screen (82cd43d). Trang duyệt vòng 1: https://claude.ai/artifact/WZCzEq7hRXB4p8fC6p34ma (mở ở nick tnt628). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4c3/round.json <out>`. Chờ thien duyệt; xong thì chuyển PR sẵn sàng, chờ CodeRabbit, xin review phiên khác.
- 18/11 15:18Z: #332 (U4c3, màn chặng) đã merge (c580103) theo lời thien. Tiếp U4c4: nút chuyển Chặng | Bản đồ ô | Danh sách ở đầu màn cấp, tìm trong cấp ở chế độ Danh sách (nằm trong phác ghép thien đã duyệt). Chưa có nhánh.
- 18/11 15:33Z: U4c4 chia đôi. U4c4a (tab Chặng | Bản đồ ô) ở PR nháp #333, nhánh feat/u4c4-level-views (fffcc17), verify xanh ở máy ảo. Trang duyệt: https://claude.ai/artifact/7uPj9y4Z9FdePvWmK39cKW (mở ở nick tnt628). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4c4/round.json <out>`. U4c4b (tab Danh sách có ô tìm) đã code nháp ở nhánh feat/u4c4b-level-list (gồm cả 4a, chưa có PR), mở PR sau khi #333 merge: rebase lên main mới rồi bỏ phần trùng.
- 18/11 18:18Z: U4c4a vòng 1: thien OK 3 màn laptop, Cần sửa 2 màn điện thoại không ghi chú. Đã sửa (3f7fe3b: hàng lọc một dòng vuốt ngang, 4 ô một hàng). Trang vòng 2: https://claude.ai/artifact/Y8zT6oqaJijjjVYwUkLTLH (mở ở nick tnt628), dựng lại từ `u4c4/round2.json`.
- 18/11 19:45Z: #333 (U4c4a) đã merge theo lời thien. U4c4b (tab Danh sách có ô tìm) ở PR nháp #334, nhánh feat/u4c4b-level-list-v2, verify xanh (1209 test), e2e kho-board 7/7. Trang duyệt: https://claude.ai/artifact/Bavq36cDg113faE6Jjg1QE (mở ở nick tnt628), dựng lại từ `u4c4b/round.json`. Nhánh cũ feat/u4c4b-level-list bỏ được. Chờ thien duyệt; xong thì chuyển sẵn sàng, risk:medium, xin review phiên khác.
- 18/11 20:30Z: #334 (U4c4b, tab Danh sách) đã merge (6c2fdef) theo lời thien, sau khi sửa lỗi CodeRabbit bắt (chạm chữ trên thẻ điện thoại không mở mục, ae3c268). U4c4 xong. Tiếp U4d (Học từng mục, Lấy nốt N). STATUS trên main còn ghi #334 chờ review: sửa trong PR U4d.
- 19/11 03:15Z: U4d ở PR nháp #335. Ngoài kế hoạch: sửa addItems để mục lấy từ Kho chung không bị giới hạn 20 ký tự (18 mục OpenJLPT trước giờ không lấy được).
- 19/11 03:45Z: review độc lập (tnt628) OK, không chặn. CodeRabbit 7 ý: sửa 6 ở 2e0d37e (resolve), ý take.ts (chuẩn hoá chữ) trả lời không sửa vì không mục OpenJLPT nào bị đổi chữ, để mở cho thien xem. Chờ CI và thien nói "merge đi".
