# Tiến độ

Cập nhật lần cuối: 2026-11-13 · Claude (project `chan_0145cot…`, thread "Đồng bộ Sakubun giữa các nick") · Trang tiến độ: (đăng sau khi PR này merge)

Cho mọi nick Claude, Codex và thien biết project đang ở đâu. Lịch sử ở git và PR. Tối đa 40 dòng, 3 việc chờ thien.

## Đang ở đâu

Dừng làm tính năng để đồng bộ các nick theo quy trình chung (PR này). UI v2: U0, U1 xong (U1 qua cổng ở #287); U2 (buổi ôn)
tạm dừng vì thien bác bố cục toàn màn (13/11). Mọi phần trước UI v2 (Kaiwa, Kho chung, kanji, luyện dịch) đã xong.

## Kế hoạch đang chạy

| Kế hoạch                           | Đang ở checkpoint                       | Đã tick        |
| ---------------------------------- | --------------------------------------- | -------------- |
| [UI v2](plans/2026-11-08-ui-v2.md) | U2 Phiên học: tạm dừng, chờ chọn bố cục | U0, U1 / U0–U8 |

## Việc dở

| Việc                    | Nhánh hoặc PR           | Dở từ | Còn thiếu gì                                                            |
| ----------------------- | ----------------------- | ----- | ----------------------------------------------------------------------- |
| Kế hoạch U2             | #288                    | 13/11 | Sửa theo bố cục thien chọn; bỏ phần U1 trùng với PR này                 |
| U2a–U2d buổi ôn         | #291 → #294 (xếp chồng) | 13/11 | Đã đổi về khung trang thường; chờ chọn bố cục rồi gộp lại theo luật mới |
| Đóng câu hỏi nghiên cứu | #289                    | 13/11 | Chỉ tài liệu, chờ thien merge                                           |
| Bản tóm tắt hai nick    | #295, #296              | 13/11 | Tạm, đóng sau khi PR này merge                                          |

## Việc tiếp theo

1. thien chọn bố cục buổi ôn từ 2–3 phương án, rồi làm lại U2 trên `main` theo luật "một bước, một PR" trong `CLAUDE.md`.

## Đang chờ thien

- Merge PR này (luật làm việc, risk:high), rồi dán dòng hướng dẫn project vào cả hai project Sakubun.
- Chọn hướng cho U2: bố cục buổi ôn, và thẻ chọn U2e (chấm chạy nền) / U2f (hoàn tác).
- Trên NUC, không gấp: bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản bằng tài khoản `kai`.

## Đang vướng

- e2e không chạy trong CI; `style-audit` và "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ (`docs/handoff.md` mục 4).
