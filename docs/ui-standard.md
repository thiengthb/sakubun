# Quy chuẩn UI của sakubun

Mọi trang theo file này. Số đo lấy từ bước 1 đến 4 của đợt làm lại UI mà thien đã duyệt (2026-10-24);
lý do nằm ở `docs/decisions/0003-ui-standard.md`. Cột "Khoá bởi" nói ai bắt khi có chỗ làm sai:
một test, hoặc thien qua ảnh trước và sau ở 1440 và 390.

Code viết trước quy chuẩn nằm trong `lib/design/ui-standard-debt.json`. Danh sách đó **chỉ được giảm**:
chỗ sai mới làm test đỏ, chỗ đã sửa cũng làm test đỏ cho tới khi hạ danh sách bằng
`UPDATE_UI_STANDARD_DEBT=1 npx vitest run lib/design/ui-standard.test.ts`. Mỗi PR làm lại một trang
(bước 6) trả phần nợ của trang đó.

## Cỡ và bo

| Luật                                                                                                                                                                                                                                                                                                                                         | Khoá bởi                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Nút và ô cao 36px trên điện thoại, 28px từ 768px, tính theo mắt nhìn: gờ 2px của nút nổi nằm trong chiều cao đó (khung 34 hoặc 26px, chừa 2px bên dưới cho gờ). Ô nhập và nút cùng hàng trùng mép trên và mép dưới. Vùng chạm 44px trên màn cảm ứng; icon 16px.                                                                              | `e2e/control-size.spec.ts`, thienui `icon-size-scale`, `button-size-by-prop` |
| Bo 8px cho nút, ô, thẻ và hộp thoại (thien chọn 7px ngày 2026-10-25 khi so từ 4 tới 10px, rồi nâng lên 8px sau khi xem trên trang thật). Hộp nhỏ từ 20px trở xuống (ô đánh dấu) bo 4px (`rounded-xs`), vì 8px trên hộp 16px thành hình tròn. Chỉ dùng thang `rounded`, `-xs` tới `-2xl`, `-full`, hoặc giá trị tuỳ ý đọc token `--radius-*`. | `ui-standard` `radius-class`, test thang bo                                  |
| Không nút, link, toggle hay ô nào bo tròn hẳn. `rounded-full` chỉ cho chấm, thanh tiến độ, ảnh đại diện.                                                                                                                                                                                                                                     | `ui-standard` `no-round-controls`                                            |

## Chữ

| Luật                                                                                                                                                                                                                                                                | Khoá bởi                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Tiêu đề trang 18px điện thoại, 24px laptop, đậm 700 (`font-extrabold`); tiêu đề phần 14px đậm 600 (`font-bold`); nội dung 14px; meta 12px.                                                                                                                          | `type-scale.test.ts`, test token đậm, `e2e/font-weight.spec.ts` |
| Một luật đậm cho cả trang (thien, 2026-10-25): chữ đậm nhất 700, đậm 600; nút, chip, badge, mục menu, tab, ô chọn và sidebar đậm 500, lấy từ component, trang không tự làm đậm; icon nét 1.5 (`LucideProvider` trong `app/layout.tsx`), không tự đặt `strokeWidth`. | `ui-standard` `control-weight`, `e2e/font-weight.spec.ts`       |

## Nút và ô

| Luật                                                                                                                                                                                                                                                                                  | Khoá bởi                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Mọi viền điều khiển 2px, cùng màu `--control-edge`, sáng và tối.                                                                                                                                                                                                                      | `ui-standard` `control-language-in-components` |
| Thứ bấm được thì nổi: bóng đáy 2px, lún xuống khi bấm. Ô gõ chữ phẳng, nền `--field` sáng hơn.                                                                                                                                                                                        | như trên                                       |
| Mục đang chọn (kiểu xem, lựa chọn trong cài đặt) có nền cam nhạt phủ tới mép và bóng đáy nhẹ, không viền cam đậm. Dùng `variant="choice"` hoặc `choiceChipClass()`. Trang đang mở ở sidebar dùng nền thẻ (trắng ở nền sáng) như thẻ người dùng, vì nền cam nhạt chìm vào nền sidebar. | như trên, ảnh                                  |
| Nút gợi ý tạo cái chưa có dùng `variant="dashed"`.                                                                                                                                                                                                                                    | ảnh                                            |
| Menu, popover và danh sách chọn luôn nằm trọn trong màn hình, cách mỗi mép ít nhất 16px (lề trang), cả điện thoại lẫn laptop. Mặc định nằm trong `components/ui` (`FLOATING_GUTTER`); đừng đặt `collisionPadding` nhỏ hơn.                                                            | `e2e/menu-bounds.spec.ts`                      |
| Các class trên chỉ nằm trong `components/ui`, `common`, `layout`. Trang và feature dùng component, không chép class.                                                                                                                                                                  | `ui-standard` `control-language-in-components` |

## Nhãn nút

| Luật                                                                                                                                       | Khoá bởi                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 1 đến 2 từ trên điện thoại, 1 đến 3 từ trên laptop.                                                                                        | ảnh                             |
| Nút tạo mới (icon `Plus` kèm chữ) ghi đúng "Thêm", không thêm chữ ngữ cảnh.                                                                | `ui-standard` `create-label`    |
| Nút chỉ có icon dùng icon trong `PLAIN_ICONS` (`lib/design/ui-standard.ts`) và có `aria-label`. Icon khác phải có chữ đi kèm.              | `ui-standard` `icon-only-plain` |
| Mô tả hiện khi giữ chuột 0,5 giây và khi focus; nút bị khoá nói vì sao. Sau nút (i) dùng `TapTooltip`, vì tooltip Radix không mở khi chạm. | ảnh                             |

## Đầu trang

| Luật                                                                                                                                                                                                                                                                                                                                                                                           | Khoá bởi                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Điện thoại: một hàng 36px gồm logo, khối tiêu đề hai dòng, nút, sao. Trang cấp một: tiêu đề trên, meta dưới. Trang lồng: đường dẫn trên, tiêu đề dưới.                                                                                                                                                                                                                                         | `e2e/phone-header.spec.ts`, ảnh                                                             |
| Trang có nhiều thông tin ở đầu (chi tiết mục: nghĩa, Hán Việt, cấp độ, trạng thái) dùng đầu trang chi tiết (`PageShell` với `facts`, thien chọn ngày 2026-10-25). Điện thoại: hàng 36px chỉ còn logo, đường dẫn, sao; tiêu đề một dòng riêng 24px, laptop 30px. Dưới tiêu đề là nghĩa, rồi các giá trị có nhãn (Cấp độ, Trạng thái). Hán Việt luôn viết hoa, trong [ ], dòng riêng dưới nghĩa. | `e2e/phone-header.spec.ts`, `e2e/mobile-layout.spec.ts`, `components/layout/page-chrome.ts` |
| Mục đang ở trạng thái đổi nghĩa cả trang (tạm ngưng) có băng `StateNotice` ở đầu thân trang kèm nút đưa về, và phần thân nhạt, xám.                                                                                                                                                                                                                                                            | ảnh                                                                                         |
| Laptop: dòng đường dẫn phía trên tiêu đề luôn giữ chỗ, kể cả khi trống.                                                                                                                                                                                                                                                                                                                        | `components/layout/page-chrome.ts`, ảnh                                                     |
| Tab gạch chân (`PageTabs`); icon trên tab chỉ hiện trên laptop.                                                                                                                                                                                                                                                                                                                                | ảnh                                                                                         |

## Bốn khuôn trang

| Khuôn        | Dùng khi                                                                          |
| ------------ | --------------------------------------------------------------------------------- |
| Danh sách    | Nhiều mục cùng loại, có tìm và lọc: Tài nguyên, Nhóm, Lịch sử.                    |
| Chi tiết     | Một mục: ô số liệu bằng nhau (4x2 laptop, 2x4 điện thoại), lịch sử ôn theo tháng. |
| Form         | Thêm hoặc sửa: trang riêng, nút lưu ở chân form.                                  |
| Bảng số liệu | Tổng quan và Phân tích: ô số, biểu đồ.                                            |

| Luật                                                                                                                               | Khoá bởi                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Thêm và sửa là trang riêng. Hộp thoại chỉ để xác nhận hoặc sửa nhanh một ô: không chứa component form, tối đa một ô nhập.          | `ui-standard` `no-form-dialog`                        |
| Mỗi trang dùng đúng một khuôn của PageShell (`template` và `title`); PageShell và PageSkeleton cùng lấy class từ `page-chrome.ts`. | `ui-standard` `page-template`, `e2e/skeleton.spec.ts` |

### Đang tải

Trang đang tải là trang thật chưa có dữ liệu, giống nhau ở mọi trang (thien, Phân tích vòng 1).

| Luật                                                                                                                                                                                                                     | Khoá bởi                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Đầu trang viết bằng chữ thật mọi thứ trang biết trước: tiêu đề, đường dẫn, tên tab, nhãn ô số liệu. Chỉ chữ phải chờ dữ liệu (tên mục, mục là ngữ pháp hay từ vựng) mới là thanh xám (`SkeletonText`), rộng bằng chữ đó. | `ui-standard` `page-template`, `e2e/skeleton.spec.ts` |
| Tab lấy từ cùng một `PageTabSet` (`components/layout/page-heads.tsx`) với trang, và gạch chân tab sẽ mở.                                                                                                                 | `skeleton-parity.test.ts`                             |
| Phần thân giữ đúng chỗ: đầu trang cao bằng, thân bắt đầu cùng một dòng.                                                                                                                                                  | `e2e/skeleton.spec.ts`                                |

## Bố cục

| Luật                                                                                                  | Khoá bởi |
| ----------------------------------------------------------------------------------------------------- | -------- |
| Hẹp hơn 1024px: danh sách thẻ, cuộn để tải thêm. Từ 1024px: bảng có phân trang.                       | ảnh      |
| Đổi theo bề rộng hộp chứa (container query), không theo màn hình, cho mọi component dùng lại.         | ảnh      |
| Lề 16px điện thoại, 32px laptop, rộng tối đa 1152px. Cách giữa các phần 24px điện thoại, 32px laptop. | ảnh      |

## Chữ trên trang và trạng thái

| Luật                                                                                                                                                            | Khoá bởi     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Mỗi phần giữ tiêu đề và nhãn; giải thích dài để sau nút (i).                                                                                                    | ảnh          |
| Cách đọc tiếng Nhật nằm bên tiêu đề dạng `[かな]`, chữ nhỏ, cùng đường chân chữ; không đặt furigana phía trên tiêu đề.                                          | ảnh          |
| Sáu trạng thái của nút (thường, giữ chuột, focus, bấm, khoá, đang tải) và sáu trạng thái dữ liệu (rỗng, đang tải, lỗi, chữ dài, số 0, số rất lớn) theo thienui. | thienui, ảnh |
| Trạng thái rỗng là hộp viền đứt căn trái, không lặp nút đã có ở đầu trang.                                                                                      | ảnh          |
