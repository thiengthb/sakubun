# Tiến độ

Cập nhật lần cuối: 2026-11-13 · Claude (project `chan_0145cot…`, thread "Đồng bộ Sakubun giữa các nick") · Trang tiến độ: https://claude.ai/artifact/GmergauKMVF2n9HT3WSfxo

Cho mọi nick Claude, Codex và thien biết project đang ở đâu. Lịch sử ở git và PR. Tối đa 40 dòng, 3 việc chờ thien.

## Đang ở đâu

Đã áp quy trình chung (#297). UI v2: U0, U1 xong; U2 (buổi ôn) làm tiếp theo bố cục C thien chọn ngày 13/11 (thẻ trái,
bảng nhỏ phải, giữ sidebar và thanh tab). Mọi phần trước UI v2 (Kaiwa, Kho chung, kanji, luyện dịch) đã xong.

## Kế hoạch đang chạy

| Kế hoạch                                           | Đang ở checkpoint          | Đã tick        |
| -------------------------------------------------- | -------------------------- | -------------- |
| [UI v2](plans/2026-11-08-ui-v2.md)                 | U2 Buổi ôn                 | U0, U1 / U0–U8 |
| [U2 buổi ôn](plans/2026-11-13-u2-study-session.md) | 1. U2a khung theo bố cục C | 0 / 5          |

## Việc dở

| Việc                    | Nhánh hoặc PR           | Dở từ | Còn thiếu gì                                                                |
| ----------------------- | ----------------------- | ----- | --------------------------------------------------------------------------- |
| Kế hoạch U2             | #288                    | 13/11 | Đã viết lại theo mẫu, ghi bố cục C; chờ thien merge                         |
| U2a–U2d buổi ôn         | #291 → #294 (xếp chồng) | 13/11 | #291 đang làm bố cục C; #292–#294 về `main` lần lượt sau khi PR trước merge |
| Đóng câu hỏi nghiên cứu | #289                    | 13/11 | Chỉ tài liệu, chờ thien merge                                               |
| Bản tóm tắt hai nick    | #296                    | 13/11 | Tạm, của nick kia; đóng khi thien so xong                                   |

## Việc tiếp theo

1. Làm bố cục C trong #291, gửi ảnh duyệt; rồi #292, #293, #294 lần lượt (kế hoạch U2).

## Đang chờ thien

- Dán dòng hướng dẫn project vào cả hai project Sakubun (nội dung trong mô tả #297).
- Trả lời thẻ chọn U2e (chấm chạy nền) / U2f (hoàn tác) trong thread; chi tiết ở kế hoạch U2.
- Trên NUC, không gấp: bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản bằng tài khoản `kai`.

## Đang vướng

- e2e không chạy trong CI; `style-audit` và "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ (`docs/handoff.md` mục 4).
