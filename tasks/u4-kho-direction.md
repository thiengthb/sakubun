# U4: chọn hướng màn Kho

Repo: thiengthb/sakubun · Nhánh: docs/u4-kho-direction · PR: #313 (nháp)
Ghi bởi: Claude, project sakubun (nick 628), thread "Làm lại giao diện Sakubun (UI v2)" · Cập nhật: 2026-11-14T10:55Z

## thien muốn gì
Làm lại màn Kho (UI v2, giai đoạn U4). Vòng 1 thien chọn A nhưng chưa ưng, hỏi có nhất thiết gộp Kho của bạn và Kho chung không; nếu gộp thì gộp thế nào. Nguyên văn trong `docs/plans/2026-11-14-u4-kho.md`.

## Đã xong
- Vòng 1 và vòng 2 chọn hướng, ghi trong `docs/plans/2026-11-14-u4-kho.md` (PR #313, commit 06ddd51, 87cb97e); nguồn trang, ảnh và trang phác ở `docs/plans/2026-11-14-u4-kho/`.

## Bước tiếp theo
1. Khi thien chọn hướng: ghi nguyên văn vào mục "Kết quả" của vòng 2 trong file kế hoạch, ghi lại D6 (K2 a) trong `docs/plans/2026-11-08-ui-v2.md` vì cả ba hướng bỏ công tắc.
2. Viết checkpoint U4a… vào file kế hoạch trong PR #313, thien duyệt rồi mới code (mỗi checkpoint một PR từ main).

## Đang chờ thien
- Trang: https://claude.ai/artifact/CBDMhuJRQebewHhwEfzckp (chỉ nick 628) · Hỏi gì: Kho của bạn và Kho chung gộp hay tách; ba hướng 1 không gộp, 2 gộp theo cấp JLPT (Claude đề xuất), 3 tìm là chính.
- Đăng lại: `node artifacts/decide/make-decision.mjs <sakubun>/docs/plans/2026-11-14-u4-kho/round2/decision.json <out>` (chạy trong bản clone thienai-workflow) rồi gọi Artifact với `<out>/publish.json`; nguồn ở `docs/plans/2026-11-14-u4-kho/round2/` trên nhánh docs/u4-kho-direction.

## Lưu ý
- Không commit trang phác vào `app/`; cách chụp lại ở cuối file kế hoạch.
- Lựa chọn thien bấm trên trang cũ chỉ nick 628 đọc được; ở nick khác hỏi thien nhắn bằng chữ hoặc đăng lại trang.
