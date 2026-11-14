# Tiến độ

Cập nhật lần cuối: 2026-11-14 · Claude (project `chan_0145cot…`, thread U2 buổi ôn) · Trang tiến độ: https://claude.ai/artifact/GmergauKMVF2n9HT3WSfxo

Cho mọi nick Claude, Codex và thien biết project đang ở đâu. Lịch sử ở git và PR. Tối đa 40 dòng, 3 việc chờ thien.

## Đang ở đâu

Đã áp quy trình chung (#297). UI v2: U0, U1 xong; U2 (buổi ôn) theo bố cục C thien chọn ngày 13/11 (thẻ trái,
bảng nhỏ phải, giữ sidebar và thanh tab): U2a xong (#291, 14/11), U2b–U2d xong (#292–#294), U2e chấm chạy nền xong (#302), U2f hoàn tác xong (#303); đang làm U2g tự sang thẻ khi chọn đúng. Mọi phần trước UI v2 đã xong.

## Kế hoạch đang chạy

| Kế hoạch                                           | Đang ở checkpoint | Đã tick        |
| -------------------------------------------------- | ----------------- | -------------- |
| [UI v2](plans/2026-11-08-ui-v2.md)                 | U2 Buổi ôn        | U0, U1 / U0–U8 |
| [U2 buổi ôn](plans/2026-11-13-u2-study-session.md) | 5. U2e, U2f, U2g  | 4 / 5          |

## Việc dở

| Việc                    | Nhánh hoặc PR | Dở từ | Còn thiếu gì                              |
| ----------------------- | ------------- | ----- | ----------------------------------------- |
| U2g tự sang thẻ         | #304          | 14/11 | Đã duyệt ảnh (2/2), chờ thien merge       |
| Đóng câu hỏi nghiên cứu | #289          | 13/11 | Chỉ tài liệu, chờ thien merge             |
| Bản tóm tắt hai nick    | #296          | 13/11 | Tạm, của nick kia; đóng khi thien so xong |

## Việc tiếp theo

1. Sau U2g: U3 theo kế hoạch UI v2 (đưa 2–3 bố cục trước khi code).

## Đang chờ thien

- Merge #304 (U2g tự sang thẻ, đã duyệt ảnh 2/2).
- Dán dòng hướng dẫn project vào cả hai project Sakubun (nội dung trong mô tả #297).
- Trên NUC, không gấp: bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản bằng tài khoản `kai`.

## Đang vướng

- e2e không chạy trong CI; `style-audit` và "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ (`docs/handoff.md` mục 4).
- e2e "quick review at 390px" đỏ khoảng 1/2 lần khi chạy cùng `bottom-nav` và `review-kanji`, cả trên `main` (14/11): đáp án dừng ở y=414, chưa sát đáy. Chưa rõ nguyên nhân.
