# Tiến độ

Cập nhật lần cuối: 2026-11-14 · Claude (project `chan_0145cot…`, thread U2 buổi ôn) · Trang tiến độ: https://claude.ai/artifact/GmergauKMVF2n9HT3WSfxo

Cho mọi nick Claude, Codex và thien biết project đang ở đâu. Lịch sử ở git và PR. Tối đa 40 dòng, 3 việc chờ thien.

## Đang ở đâu

Đã áp quy trình chung (#297). UI v2: U0, U1 xong; U2 (buổi ôn) theo bố cục C thien chọn ngày 13/11 (thẻ trái,
bảng nhỏ phải, giữ sidebar và thanh tab): U2a xong (#291, 14/11), U2b–U2d xong (#292–#294), U2e chấm chạy nền xong (#302), U2f hoàn tác xong (#303), U2g tự sang thẻ khi chọn đúng xong (#304), sửa buổi ôn 390px (#305): U2 xong. U3 Hôm nay: thien chọn bố cục A (14/11), kế hoạch đã merge (#306); U3a (số liệu) xong (#308); U3b (trang Hôm nay ở `/`, Phân tích sang `/analytics`) thien duyệt ảnh Hôm nay 14/11; Phân tích cần làm lại bố cục ở giai đoạn 7 (Tiến độ). Mọi phần trước UI v2 đã xong, trừ việc thử thật K2, K8, L5 trong claude.ai (xem `roadmap.md`).

## Kế hoạch đang chạy

| Kế hoạch                                   | Đang ở checkpoint | Đã tick       |
| ------------------------------------------ | ----------------- | ------------- |
| [UI v2](plans/2026-11-08-ui-v2.md)         | U3 Hôm nay        | U0–U2 / U0–U8 |
| [U3 Hôm nay](plans/2026-11-14-u3-today.md) | U3b trang Hôm nay | U3a / U3a–U3d |

## Việc dở

| Việc                    | Nhánh hoặc PR | Dở từ | Còn thiếu gì                              |
| ----------------------- | ------------- | ----- | ----------------------------------------- |
| U3b trang Hôm nay       | PR U3b        | 14/11 | Ảnh đã duyệt; chờ review và merge         |
| Đóng câu hỏi nghiên cứu | #289          | 13/11 | Chỉ tài liệu, chờ thien merge             |
| Bản tóm tắt hai nick    | #296          | 13/11 | Tạm, của nick kia; đóng khi thien so xong |

## Việc tiếp theo

1. Sau U3b: U3c (người mới chọn cấp), rồi U3d, mỗi bước một PR.

## Đang chờ thien

- Merge #308 (U3a) để mở PR U3b.
- Dán dòng hướng dẫn project vào cả hai project Sakubun (nội dung trong mô tả #297).
- Trên NUC, không gấp: bấm Hiện "N5 · Ngữ pháp" ở Quản trị; thử chia sẻ kịch bản bằng tài khoản `kai`.

## Đang vướng

- e2e không chạy trong CI; `style-audit` và "lost answer" đỏ tuỳ thứ tự khi chạy cả bộ (`docs/handoff.md` mục 4).
