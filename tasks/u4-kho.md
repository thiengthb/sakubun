# U4: màn Kho theo cấp JLPT (U4c2 màn cấp chờ duyệt)

Repo: thiengthb/sakubun · Nhánh: feat/u4c2-level-screen · PR: #331
Ghi bởi: Claude tnt628, https://claude.ai/code/project/chan_0145cotX9neLQKZjxfBxCwDe?thread=cmsg_0145cotX9neLQKZjxfBxCwDeWAuBVAmkrKtfkT3LpFP7mf · Cập nhật: 2026-11-18T14:35Z

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

## Lưu ý
- Máy ảo: `npm ci` cần `npm_config_nodedir=/opt/node22`; `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`; e2e chạy bằng Chrome hệ thống (config tạm với `channel: 'chrome'`, không commit). `npm run build` lỗi ở máy ảo vì không tải được Google Fonts, CI thì xanh.
- `lib/insights/dashboard-model.test.ts` đỏ ở máy ảo cả trên main (không phải lỗi của U4), CI xanh.
