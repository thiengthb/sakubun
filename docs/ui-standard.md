# Quy chuẩn UI của sakubun

Mọi trang theo file này. Số đo lấy từ bước 1 đến 4 của đợt làm lại UI mà thien đã duyệt (2026-10-24);
lý do nằm ở `docs/decisions/0003-ui-standard.md`. Cột "Khoá bởi" nói ai bắt khi có chỗ làm sai:
một test, hoặc thien qua ảnh trước và sau ở 1440 và 390.

Code viết trước quy chuẩn nằm trong `lib/design/ui-standard-debt.json`. Danh sách đó **chỉ được giảm**:
chỗ sai mới làm test đỏ, chỗ đã sửa cũng làm test đỏ cho tới khi hạ danh sách bằng
`UPDATE_UI_STANDARD_DEBT=1 npx vitest run lib/design/ui-standard.test.ts`. Mỗi PR làm lại một trang
(bước 6) trả phần nợ của trang đó.

## Cỡ và bo

| Luật | Khoá bởi |
| --- | --- |
| Nút và ô cao 36px trên điện thoại, 28px từ 768px, tính theo mắt nhìn: gờ 2px của nút nổi nằm trong chiều cao đó (khung 34 hoặc 26px, chừa 2px bên dưới cho gờ). Ô nhập và nút cùng hàng trùng mép trên và mép dưới. Vùng chạm 44px trên màn cảm ứng; icon 16px. | `e2e/control-size.spec.ts`, thienui `icon-size-scale`, `button-size-by-prop` |
| Bo 8px cho nút, ô, thẻ và hộp thoại (thien chọn 7px ngày 2026-10-25 khi so từ 4 tới 10px, rồi nâng lên 8px sau khi xem trên trang thật). Chỉ dùng thang `rounded`, `-sm` tới `-2xl`, `-full`, hoặc giá trị tuỳ ý đọc token `--radius-*`. | `ui-standard` `radius-class`, test thang bo |
| Không nút, link, toggle hay ô nào bo tròn hẳn. `rounded-full` chỉ cho chấm, thanh tiến độ, ảnh đại diện. | `ui-standard` `no-round-controls` |

## Chữ

| Luật | Khoá bởi |
| --- | --- |
| Tiêu đề trang 18px điện thoại, 24px laptop, đậm 800; tiêu đề phần 14px đậm 700; nội dung 14px; meta 12px. | `type-scale.test.ts`, ảnh |

## Nút và ô

| Luật | Khoá bởi |
| --- | --- |
| Mọi viền điều khiển 2px, cùng màu `--control-edge`, sáng và tối. | `ui-standard` `control-language-in-components` |
| Thứ bấm được thì nổi: bóng đáy 2px, lún xuống khi bấm. Ô gõ chữ phẳng, nền `--field` sáng hơn. | như trên |
| Mục đang chọn (kiểu xem, lựa chọn trong cài đặt) có nền cam nhạt phủ tới mép và bóng đáy nhẹ, không viền cam đậm. Dùng `variant="choice"` hoặc `choiceChipClass()`. Trang đang mở ở sidebar dùng nền thẻ (trắng ở nền sáng) như thẻ người dùng, vì nền cam nhạt chìm vào nền sidebar. | như trên, ảnh |
| Nút gợi ý tạo cái chưa có dùng `variant="dashed"`. | ảnh |
| Menu, popover và danh sách chọn luôn nằm trọn trong màn hình, cách mỗi mép ít nhất 16px (lề trang), cả điện thoại lẫn laptop. Mặc định nằm trong `components/ui` (`FLOATING_GUTTER`); đừng đặt `collisionPadding` nhỏ hơn. | `e2e/menu-bounds.spec.ts` |
| Các class trên chỉ nằm trong `components/ui`, `common`, `layout`. Trang và feature dùng component, không chép class. | `ui-standard` `control-language-in-components` |

## Nhãn nút

| Luật | Khoá bởi |
| --- | --- |
| 1 đến 2 từ trên điện thoại, 1 đến 3 từ trên laptop. | ảnh |
| Nút tạo mới (icon `Plus` kèm chữ) ghi đúng "Thêm", không thêm chữ ngữ cảnh. | `ui-standard` `create-label` |
| Nút chỉ có icon dùng icon trong `PLAIN_ICONS` (`lib/design/ui-standard.ts`) và có `aria-label`. Icon khác phải có chữ đi kèm. | `ui-standard` `icon-only-plain` |
| Mô tả hiện khi giữ chuột 0,5 giây và khi focus; nút bị khoá nói vì sao. Sau nút (i) dùng `TapTooltip`, vì tooltip Radix không mở khi chạm. | ảnh |

## Đầu trang

| Luật | Khoá bởi |
| --- | --- |
| Điện thoại: một hàng 36px gồm logo, khối tiêu đề hai dòng, nút, sao. Trang cấp một: tiêu đề trên, meta dưới. Trang lồng: đường dẫn trên, tiêu đề dưới. | `e2e/phone-header.spec.ts`, ảnh |
| Laptop: dòng đường dẫn phía trên tiêu đề luôn giữ chỗ, kể cả khi trống. | `components/layout/page-chrome.ts`, ảnh |
| Tab gạch chân (`PageTabs`); icon trên tab chỉ hiện trên laptop. | ảnh |

## Bốn khuôn trang

| Khuôn | Dùng khi |
| --- | --- |
| Danh sách | Nhiều mục cùng loại, có tìm và lọc: Tài nguyên, Nhóm, Lịch sử. |
| Chi tiết | Một mục: ô số liệu bằng nhau (4x2 laptop, 2x4 điện thoại), lịch sử ôn theo tháng. |
| Form | Thêm hoặc sửa: trang riêng, nút lưu ở chân form. |
| Bảng số liệu | Tổng quan và Phân tích: ô số, biểu đồ. |

| Luật | Khoá bởi |
| --- | --- |
| Thêm và sửa là trang riêng. Hộp thoại chỉ để xác nhận hoặc sửa nhanh một ô: không chứa component form, tối đa một ô nhập. | `ui-standard` `no-form-dialog` |
| Mỗi trang dùng đúng một khuôn của PageShell (`template` và `title`); PageShell và PageSkeleton cùng lấy class từ `page-chrome.ts`. | `ui-standard` `page-template`, `e2e/skeleton.spec.ts` |

## Bố cục

| Luật | Khoá bởi |
| --- | --- |
| Hẹp hơn 1024px: danh sách thẻ, cuộn để tải thêm. Từ 1024px: bảng có phân trang. | ảnh |
| Đổi theo bề rộng hộp chứa (container query), không theo màn hình, cho mọi component dùng lại. | ảnh |
| Lề 16px điện thoại, 32px laptop, rộng tối đa 1152px. Cách giữa các phần 24px điện thoại, 32px laptop. | ảnh |

## Chữ trên trang và trạng thái

| Luật | Khoá bởi |
| --- | --- |
| Mỗi phần giữ tiêu đề và nhãn; giải thích dài để sau nút (i). | ảnh |
| Cách đọc tiếng Nhật nằm bên tiêu đề dạng `[かな]`, chữ nhỏ, cùng đường chân chữ; không đặt furigana phía trên tiêu đề. | ảnh |
| Sáu trạng thái của nút (thường, giữ chuột, focus, bấm, khoá, đang tải) và sáu trạng thái dữ liệu (rỗng, đang tải, lỗi, chữ dài, số 0, số rất lớn) theo thienui. | thienui, ảnh |
| Trạng thái rỗng là hộp viền đứt căn trái, không lặp nút đã có ở đầu trang. | ảnh |
