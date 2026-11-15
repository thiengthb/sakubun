# U4: màn Kho theo cấp JLPT (U4b chờ review, rồi U4c)

Repo: thiengthb/sakubun · Nhánh: feat/u4b-kho-level-board · PR: #323
Ghi bởi: Claude tnt697, https://claude.ai/code/session_01WXAvBWYJAVsv6v7gffV9Cb · Cập nhật: 2026-11-15T07:23Z

## thien muốn gì
Làm U4 theo kế hoạch đã duyệt `docs/plans/2026-11-14-u4-kho.md` (hướng 2, gộp theo cấp JLPT; 15/11 thien trả lời "theo đề xuất" cả 3 câu, U4g/U4h để sau kỳ thi N2). thien bảo nick tnt697 làm tiếp ("nick này làm tiếp", 15/11).

## Đã xong
- Kế hoạch và kết quả chọn hướng: PR #313 (merge).
- U4a số theo cấp: PR #322 (merge), `lib/library/level-tally.ts`, `lib/app/level-board.ts`.
- U4b màn Kho là bảng cấp: PR #323, CI xanh, risk:medium, ảnh ở `docs/plans/2026-11-14-u4-kho/u4b/`.

## Bước tiếp theo
1. Xử lý 2 comment của CodeRabbit trên #323 (`app/resources/all/loading.tsx:23`, `app/resources/loading.tsx:9`), đẩy lên nhánh `feat/u4b-kho-level-board`.
2. Một phiên khác review #323 (luật risk:medium trong `CLAUDE.md`), rồi merge.
3. U4c (danh sách một cấp) theo kế hoạch: nhánh mới từ `main`, mở PR nháp `U4c: ...` ngay. Các ô bảng cấp hiện mở `/library?tab=items&type=..&level=..` (`cellHref` trong `level-tally.ts`); U4c đổi sang route danh sách cấp.

## Đang chờ thien
- Review hoặc nhờ phiên khác review PR #323 rồi merge.

## Lưu ý
- Máy ảo: `npm ci` cần `npm_config_nodedir=/opt/node22`; `prisma generate` cần `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true`; e2e chạy bằng Chrome hệ thống (config tạm với `channel: 'chrome'`, không commit). `npm run build` lỗi ở máy ảo vì không tải được Google Fonts, CI thì xanh.
- `lib/insights/dashboard-model.test.ts` đỏ ở máy ảo cả trên main (không phải lỗi của U4), CI xanh.
