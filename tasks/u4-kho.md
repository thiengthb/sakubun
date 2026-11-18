# U4: màn Kho theo cấp JLPT (U4c3 màn chặng chờ duyệt)

Repo: thiengthb/sakubun · Nhánh: feat/u4c3-set-screen · PR: #332
Ghi bởi: Claude tnt628, https://claude.ai/code/project/chan_0145cotX9neLQKZjxfBxCwDe?thread=cmsg_0145cotX9neLQKZjxfBxCwDeWAuBVAmkrKtfkT3LpFP7mf · Cập nhật: 2026-11-18T19:44Z

## thien muốn gì
Làm U4 theo kế hoạch đã duyệt `docs/plans/2026-11-14-u4-kho.md` (hướng 2, gộp theo cấp JLPT; 15/11 thien trả lời "theo đề xuất" cả 3 câu, U4g/U4h để sau kỳ thi N2). thien bảo nick tnt697 làm tiếp ("nick này làm tiếp", 15/11).

## Đã xong
- Kế hoạch: PR #313. U4a số theo cấp: #322. U4b bảng cấp: #323 (merge 18/11).
- U4c bố cục: vòng 1 bị bác; vòng 2 thien chọn A và duyệt bản gộp (18/11), ghi trong kế hoạch mục "U4c (15/11)", ảnh `u4c-r2/combo-*.jpg`.
- U4c1 logic chia chặng: #325 (merge 18/11), `lib/library/level-sets.ts`, `lib/app/level-sets.ts`.

## Bước tiếp theo
1. U4c2 màn cấp, PR #331 (risk:medium, đã sẵn sàng): thien OK vòng 1 kèm hai góp ý (đã sửa); CodeRabbit 5 ý đã sửa và resolve. Đã nhờ coordinator mở thread review. Merge khi review xong và thien bảo.
2. Rồi U4c3 (màn chặng: 20 ô có nghĩa, chi tiết bên phải hoặc tấm trượt, chặng trước/sau), U4c4 (Bản đồ ô, Danh sách, tìm trong cấp).

## Đang chờ thien
- Chọn cách tô vạch của chặng, vòng 3: https://claude.ai/artifact/TeQjKvDj9jPzxkQD2zysR6 (mở ở nick tnt628; A vạch xanh, B ô vuông cam, C chấm tròn). Ô Bước tiếp theo đã chốt (vòng 2). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4c2/round-3.json <out>`; áp bản được chọn theo `u4c2/variants.py.txt`.
- 18/11 14:40Z: thien chọn B ở vòng 3, đã áp ở 1df8419 trên #331. Chờ thien nói "merge đi" (review phiên khác đã OK), rồi làm U4c3 (màn chặng; thẻ chặng thành link).
- 18/11 14:42Z: thien nói "merge đi", #331 đã merge (524e5c6). Tiếp: U4c3 (màn chặng), nhánh mới từ main, mở PR nháp ngay.

## Lưu ý
- Máy ảo: `npm ci` cần `npm_config_nodedir=/opt/node22`; `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`; e2e chạy bằng Chrome hệ thống (config tạm với `channel: 'chrome'`, không commit). `npm run build` lỗi ở máy ảo vì không tải được Google Fonts, CI thì xanh.
- `lib/insights/dashboard-model.test.ts` đỏ ở máy ảo cả trên main (không phải lỗi của U4), CI xanh.
- 18/11 14:50Z: U4c3 (màn chặng) ở PR nháp #332, nhánh feat/u4c3-set-screen (82cd43d). Trang duyệt vòng 1: https://claude.ai/artifact/WZCzEq7hRXB4p8fC6p34ma (mở ở nick tnt628). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4c3/round.json <out>`. Chờ thien duyệt; xong thì chuyển PR sẵn sàng, chờ CodeRabbit, xin review phiên khác.
- 18/11 15:18Z: #332 (U4c3, màn chặng) đã merge (c580103) theo lời thien. Tiếp U4c4: nút chuyển Chặng | Bản đồ ô | Danh sách ở đầu màn cấp, tìm trong cấp ở chế độ Danh sách (nằm trong phác ghép thien đã duyệt). Chưa có nhánh.
- 18/11 15:33Z: U4c4 chia đôi. U4c4a (tab Chặng | Bản đồ ô) ở PR nháp #333, nhánh feat/u4c4-level-views (fffcc17), verify xanh ở máy ảo. Trang duyệt: https://claude.ai/artifact/7uPj9y4Z9FdePvWmK39cKW (mở ở nick tnt628). Dựng lại: `make-round.mjs docs/plans/2026-11-14-u4-kho/u4c4/round.json <out>`. U4c4b (tab Danh sách có ô tìm) đã code nháp ở nhánh feat/u4c4b-level-list (gồm cả 4a, chưa có PR), mở PR sau khi #333 merge: rebase lên main mới rồi bỏ phần trùng.
- 18/11 18:18Z: U4c4a vòng 1: thien OK 3 màn laptop, Cần sửa 2 màn điện thoại không ghi chú. Đã sửa (3f7fe3b: hàng lọc một dòng vuốt ngang, 4 ô một hàng). Trang vòng 2: https://claude.ai/artifact/Y8zT6oqaJijjjVYwUkLTLH (mở ở nick tnt628), dựng lại từ `u4c4/round2.json`.
- 18/11 19:45Z: #333 (U4c4a) đã merge theo lời thien. U4c4b (tab Danh sách có ô tìm) ở PR nháp #334, nhánh feat/u4c4b-level-list-v2, verify xanh (1209 test), e2e kho-board 7/7. Trang duyệt: https://claude.ai/artifact/Bavq36cDg113faE6Jjg1QE (mở ở nick tnt628), dựng lại từ `u4c4b/round.json`. Nhánh cũ feat/u4c4b-level-list bỏ được. Chờ thien duyệt; xong thì chuyển sẵn sàng, risk:medium, xin review phiên khác.
