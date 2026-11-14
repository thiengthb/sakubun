# Tiến độ

Cập nhật lần cuối: 2026-11-14 · Claude (project `chan_0145cot…`, thread U2 buổi ôn) · Trang tiến độ: https://claude.ai/artifact/GmergauKMVF2n9HT3WSfxo

Cho mọi nick Claude, Codex và thien biết project đang ở đâu. Lịch sử ở git và PR. Tối đa 40 dòng, 3 việc chờ thien.

## Đang ở đâu

Đã áp quy trình chung (#297). UI v2: U0, U1 xong; U2 (buổi ôn) theo bố cục C thien chọn ngày 13/11 (thẻ trái,
bảng nhỏ phải, giữ sidebar và thanh tab): U2a xong (#291, 14/11), U2b–U2d xong (#292–#294), U2e chấm chạy nền xong (#302), U2f hoàn tác xong (#303), U2g tự sang thẻ khi chọn đúng xong (#304): U2 xong. Mọi phần trước UI v2 đã xong.

## Kế hoạch đang chạy

| Kế hoạch                           | Đang ở checkpoint | Đã tick       |
| ---------------------------------- | ----------------- | ------------- |
| [UI v2](plans/2026-11-08-ui-v2.md) | U3 Hôm nay        | U0–U2 / U0–U8 |

## Việc dở

| Việc                    | Nhánh hoặc PR | Dở từ | Còn thiếu gì                              |
| ----------------------- | ------------- | ----- | ----------------------------------------- |
| Sửa buổi ôn 390px       | #305          | 14/11 | Chờ thien duyệt ảnh, rồi merge            |
| Đóng câu hỏi nghiên cứu | #289          | 13/11 | Chỉ tài liệu, chờ thien merge             |
| Bản tóm tắt hai nick    | #296          | 13/11 | Tạm, của nick kia; đóng khi thien so xong |

## Việc tiếp theo

1. Sau #305: U3 theo kế hoạch UI v2 (đưa 2–3 bố cục trước khi code).

## Đang chờ thien

- Duyệt ảnh sửa buổi ôn trên điện thoại rồi merge #305.
- Dán dòng hướng dẫn project vào cả hai project Sakubun (nội dung trong mô tả #297).
- Trên NUC, không gấp: bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản bằng tài khoản `kai`.

## Đang vướng

- e2e không chạy trong CI; `style-audit` và "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ (`docs/handoff.md` mục 4).
