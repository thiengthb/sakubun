# KN1 · trang duyệt ảnh

Trang duyệt (mở ở nick tnt628):

- Vòng 1 (`round.json`, `sakubun-kn1-r1`): https://claude.ai/artifact/AuzSsZe1wWUSKG2cfJ9Lu9. Kết quả 19/11: 5 màn OK (mục có cấp 1440 và 390, mục ngoài JLPT 1440, kanji 1440, Kho chung 1440), 7 màn Cần sửa. Ghi chú chung: "mình nghĩ ở trên điện thoại không cần trang nào cũng cho logo của app". Comment ghim: trang mục điện thoại "không cần logo chỉ nút quay lại và nút quay lại cũng không cần nổi"; màn chặng laptop "bỏ chữ chặng đi" ở nút Chặng trước, Chặng sau. Màn Một nguồn ngoài JLPT 1440 Cần sửa mà không có ghi chú.
- Vòng 2 (`round2.json`, `sakubun-kn1-r2`, chỉ 7 màn Cần sửa): https://claude.ai/artifact/9kztWwQ2TK7XQENUGCMuFL. Kết quả 19/11: mục ngoài JLPT 390 OK; Cần sửa: màn chặng 1440 và 390 ("các nút không đồng bộ nhau"), nguồn ngoài JLPT 390, kanji 390, Kho chung 390. Ghi chú chung: "ở các nút quay lại cho thêm icon và điều chỉnh cho nó dễ thấy chút và các nút cùng hàng thì phải cùng chiều cao… điều này đã gặp nhiều lần ở app rồi mà vẫn chưa chữa được". Màn nguồn ngoài JLPT 1440 để "Chưa xem", thích bản main.
- Vòng 3 (`round3.json`, `sakubun-kn1-r3`, 5 màn): https://claude.ai/artifact/9QHgBtnMk1q8W5GrXYLdxn. Ảnh `*__new.jpg` ở đây là bản vòng 3.

Dựng lại ở nick khác:

1. Chụp lại ảnh cỡ 2x nếu cần nét: chép `shots.spec.ts.txt` vào `e2e/zz-kn1-shots.spec.ts`, chạy một lần trên `main` với `SHOT_SIDE=old` và một lần trên nhánh KN1 với `SHOT_SIDE=new` (`SHOT_DIR=<thư mục ảnh>`), rồi sửa `file` trong `round.json` cho khớp.
2. Hoặc dùng luôn ảnh JPG ở đây (cỡ 1x): trong repo thienai-workflow chạy
   `node artifacts/compare/make-round.mjs <thư mục này>/round.json /tmp/kn1-round`
   rồi đăng theo `publish.json` nó in ra.
