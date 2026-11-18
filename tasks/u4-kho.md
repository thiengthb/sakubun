# U4: màn Kho theo cấp JLPT (U4b chờ review, rồi U4c)

Repo: thiengthb/sakubun · Nhánh: feat/u4b-kho-level-board · PR: #323
Ghi bởi: Claude tnt628, https://claude.ai/code/project/chan_0145cotX9neLQKZjxfBxCwDe?thread=cmsg_0145cotX9neLQKZjxfBxCwDeWAuBVAmkrKtfkT3LpFP7mf · Cập nhật: 2026-11-18T13:04Z

## thien muốn gì
Làm U4 theo kế hoạch đã duyệt `docs/plans/2026-11-14-u4-kho.md` (hướng 2, gộp theo cấp JLPT; 15/11 thien trả lời "theo đề xuất" cả 3 câu, U4g/U4h để sau kỳ thi N2). thien bảo nick tnt697 làm tiếp ("nick này làm tiếp", 15/11).

## Đã xong
- Kế hoạch và kết quả chọn hướng: PR #313 (merge).
- U4a số theo cấp: PR #322 (merge), `lib/library/level-tally.ts`, `lib/app/level-board.ts`.
- U4b màn Kho là bảng cấp: PR #323, risk:medium, ảnh ở `docs/plans/2026-11-14-u4-kho/u4b/`.
- 2 comment CodeRabbit trên #323 đã sửa, trả lời và resolve: commit `735135f`, CI xanh (skeleton Kho và Mọi mục khớp trang, thêm cặp `kho board` trong `e2e/skeleton.spec.ts`).

## Bước tiếp theo
1. #323 đã được phiên tnt628 review (Review: OK, 18/11); chờ thien nói merge (auto mode chặn Claude tự merge).
2. U4c: đã mở nhánh `feat/u4c-level-list`, PR nháp #325. Vòng chọn bố cục: 3 bản (A danh sách trộn, B của bạn trước, C ô số chia nhóm), nguồn đã đẩy ở commit `8ae37f7` (`docs/plans/2026-11-14-u4-kho/u4c/`), trang đã đăng, chờ thien chọn. Code chỉ sau khi thien chọn và #323 merge. Các ô bảng cấp hiện mở `/library?tab=items&type=..&level=..` (`cellHref` trong `level-tally.ts`); U4c đổi sang route danh sách cấp.

## Đang chờ thien
- U4c: thien chọn A ở vòng 2 (18/11) và muốn gộp điểm hay của cả 3. Bản gộp ở `u4c-r2/combo-level.jpg`, `combo-set.jpg` (nhánh feat/u4c-level-list, commit 836f17f), chờ thien nói ok hoặc chỉ chỗ sửa. Sau đó chia U4c thành vài PR nhỏ (khái niệm chặng, màn cấp, màn chặng).
- Nói "merge đi" cho PR #323 (đã có review OK của phiên khác, CI xanh).

## Lưu ý
- Máy ảo: `npm ci` cần `npm_config_nodedir=/opt/node22`; `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`; e2e chạy bằng Chrome hệ thống (config tạm với `channel: 'chrome'`, không commit). `npm run build` lỗi ở máy ảo vì không tải được Google Fonts, CI thì xanh.
- `lib/insights/dashboard-model.test.ts` đỏ ở máy ảo cả trên main (không phải lỗi của U4), CI xanh.
