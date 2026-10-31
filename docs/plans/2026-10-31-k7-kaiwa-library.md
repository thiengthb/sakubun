# Kế hoạch K7: đưa kịch bản lên Kho chung

- Ngày: 2026-10-31. Duyệt: thien, 2026-10-31 12:33 ("theo đề xuất", cả bốn điều bên dưới).
- Gốc: hàng K7 trong `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md` ("Publish scripts to kho chung", rủi ro high).
  Bản thảo cho thien: https://claude.ai/artifact/1UrHuwSSXrdZXw1ZhqXEqU

## Tóm tắt

Người học chia sẻ một kịch bản Hội thoại lên Kho chung, và lấy kịch bản của người khác về để nghe, nhập vai và sửa.
Làm giống hệt cách chia sẻ mục và nhóm đang có (L3): mỗi kịch bản một bản chia sẻ, chia sẻ lại thì cập nhật, gỡ được,
thích được, quản trị ẩn được. Schema chỉ cộng thêm cột.

## Người học dùng thế nào

- **Chia sẻ.** Trên trang một kịch bản của mình có nút "Chia sẻ lên Kho chung". Bấm lần đầu là đăng tiêu đề và nội
  dung bản hiện tại. Bản đã chia sẻ không tự đổi theo khi sửa; muốn người khác thấy bản mới thì bấm "Cập nhật bản chia
  sẻ". Có nút "Gỡ khỏi Kho chung" để rút về.
- **Tìm.** Trang Kho chung có thêm mục "Kịch bản". Mỗi thẻ hiện tiêu đề, số vai, số câu, người chia sẻ, số lượt thích,
  số lượt lấy. Tìm theo tiêu đề và nội dung. Bấm vào thì mở trang xem kịch bản (furigana và nghĩa), chưa lấy về vẫn
  đọc được.
- **Lấy về.** Nút "Lấy về" chép kịch bản vào Hội thoại thành một kịch bản riêng (bản 1), sửa thoải mái, không ảnh hưởng
  bản gốc. Lấy lại lần nữa không tạo bản trùng mà mở bản đã lấy. Nghe cả bài và nhập vai với AI (K6, K8) chạy như với
  kịch bản tự viết.
- **Thích và ẩn.** Như các mục khác của Kho chung; admin ẩn bằng cùng công cụ đang dùng cho thẻ và nhóm.

## Bốn điều thien đã chọn

1. **Lưu ở đâu:** dùng lại `LibraryEntry` với loại `SCRIPT` (tiêu đề vào `name`, thêm cột `body`). Thích, ẩn, số lượt
   lấy, nguồn và công cụ admin dùng chung.
2. **Hiện ở đâu:** một mục "Kịch bản" trên trang Kho chung, đặt giống mục Nhóm.
3. **Lấy về được gì:** một bản sao riêng trong Hội thoại, sửa được, không đổi theo bản gốc; lấy lại thì mở bản đã lấy.
4. **MCP:** chưa; làm trên web trước (giữ ngân sách token mô tả công cụ). `library_take` gặp một kịch bản thì trả lỗi
   ngắn bảo lấy trên web.

Giữ nguyên các luật đã có của Kho chung: mỗi bài một bản chia sẻ đang mở, tác giả rời đi thì bản chia sẻ vẫn còn,
không xoá cứng bản chia sẻ nào.

## Schema, server ép gì, các PR

- **Schema (chỉ cộng thêm):** `LibraryEntry.body` (có thể trống), loại `SCRIPT`; `Script.libraryEntryId` (có thể
  trống, không khoá ngoại, giống `Item` và `Group`).
- **Server ép:**
  - Chỉ chủ kịch bản chia sẻ, cập nhật hoặc gỡ được bản chia sẻ của mình.
  - Kịch bản phải qua được kiểm tra định dạng lúc lưu (có ít nhất một câu, giới hạn độ dài).
  - Bản đã ẩn (tác giả gỡ hoặc admin ẩn) không hiện khi tìm và không lấy về được; ai đã lấy vẫn giữ bản sao.
  - Bản lấy về chưa sửa thì không chia sẻ lại được (chỉ tạo bản trùng).
  - Lấy về lần hai trả về bản đã lấy, không tăng số lượt lấy; tác giả lấy bản của chính mình thì mở kịch bản gốc.
  - Lỗi ngắn, nêu một cách sửa.
- **K7a** (risk:high, thien merge): migration, `lib/library/script-share.ts` (thuần) và `lib/library/scripts.ts`
  (chia sẻ, cập nhật, gỡ, lấy về, danh sách, bản sao), kèm test. Chưa nối vào giao diện.
- **K7b** (risk:high, thien duyệt ảnh rồi merge): nút Chia sẻ trên trang kịch bản, mục Kịch bản trên Kho chung, trang
  xem kịch bản chung, nút Lấy về, e2e và trang duyệt ảnh 1440 và 390 (rỗng, nhiều, tiêu đề dài, đã lấy, đã ẩn).

**Xong K7** khi hai PR đã merge, thien chia sẻ thử một kịch bản và một tài khoản khác lấy về được.
