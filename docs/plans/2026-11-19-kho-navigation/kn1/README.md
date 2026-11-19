# KN1 · trang duyệt ảnh

Trang duyệt (vòng `sakubun-kn1-r1`): https://claude.ai/artifact/AuzSsZe1wWUSKG2cfJ9Lu9 (mở ở nick tnt628).

Dựng lại ở nick khác:

1. Chụp lại ảnh cỡ 2x nếu cần nét: chép `shots.spec.ts.txt` vào `e2e/zz-kn1-shots.spec.ts`, chạy một lần trên `main` với `SHOT_SIDE=old` và một lần trên nhánh KN1 với `SHOT_SIDE=new` (`SHOT_DIR=<thư mục ảnh>`), rồi sửa `file` trong `round.json` cho khớp.
2. Hoặc dùng luôn ảnh JPG ở đây (cỡ 1x): trong repo thienai-workflow chạy
   `node artifacts/compare/make-round.mjs <thư mục này>/round.json /tmp/kn1-round`
   rồi đăng theo `publish.json` nó in ra.
