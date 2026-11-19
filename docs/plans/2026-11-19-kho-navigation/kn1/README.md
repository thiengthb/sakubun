# KN1 · trang duyệt ảnh

Trang duyệt (mở ở nick tnt628):

- Vòng 1 (`round.json`, `sakubun-kn1-r1`): https://claude.ai/artifact/AuzSsZe1wWUSKG2cfJ9Lu9. Kết quả 19/11: 5 màn OK (mục có cấp 1440 và 390, mục ngoài JLPT 1440, kanji 1440, Kho chung 1440), 7 màn Cần sửa. Ghi chú chung: "mình nghĩ ở trên điện thoại không cần trang nào cũng cho logo của app". Comment ghim: trang mục điện thoại "không cần logo chỉ nút quay lại và nút quay lại cũng không cần nổi"; màn chặng laptop "bỏ chữ chặng đi" ở nút Chặng trước, Chặng sau. Màn Một nguồn ngoài JLPT 1440 Cần sửa mà không có ghi chú.
- Vòng 2 (`round2.json`, `sakubun-kn1-r2`, chỉ 7 màn Cần sửa): https://claude.ai/artifact/9kztWwQ2TK7XQENUGCMuFL. Ảnh `*__new.jpg` ở đây là bản vòng 2.

Dựng lại ở nick khác:

1. Chụp lại ảnh cỡ 2x nếu cần nét: chép `shots.spec.ts.txt` vào `e2e/zz-kn1-shots.spec.ts`, chạy một lần trên `main` với `SHOT_SIDE=old` và một lần trên nhánh KN1 với `SHOT_SIDE=new` (`SHOT_DIR=<thư mục ảnh>`), rồi sửa `file` trong `round.json` cho khớp.
2. Hoặc dùng luôn ảnh JPG ở đây (cỡ 1x): trong repo thienai-workflow chạy
   `node artifacts/compare/make-round.mjs <thư mục này>/round.json /tmp/kn1-round`
   rồi đăng theo `publish.json` nó in ra.
