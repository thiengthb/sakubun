# KN0: trang chọn cách điều hướng Kho

Trang: https://claude.ai/artifact/2sHn59iuGi9qsbvFGjwkXA (mở ở nick tnt628).

Dựng lại (nick khác không mở được trang trên):

1. Chép `options.spec.ts.txt` vào `e2e/zz-kn-options.spec.ts`, chạy với `SHOT_DIR=<dir>`: vẽ phác A, B, C thẳng lên trang thật, ra `*-1440.jpg`, `*-390.jpg` (đã có sẵn ở đây).
2. Đổi tên `composite.cjs.txt` thành `composite.cjs`, rồi `node composite.cjs <thư mục này>`: ghép ảnh laptop và điện thoại thành `a.png`, `b.png`, `c.png` theo `a.html`, `b.html`, `c.html`.
3. Trong repo thienai-workflow: `node artifacts/decide/make-decision.mjs <thư mục này>/decision.json <out>` rồi đăng theo `out/publish.json`.
