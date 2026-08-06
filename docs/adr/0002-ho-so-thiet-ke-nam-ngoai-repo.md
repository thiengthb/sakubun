# ADR 0002 — Hồ sơ thiết kế của app nằm NGOÀI repo; comment trong code là thẩm quyền

- Ngày: 2026-08-06
- Trạng thái: Accepted
- Người quyết: @thi3n (đề xuất bởi agent trong đợt rà soát `docs/progress/optimize-sweep.md`)

## Bối cảnh

Rà soát ngày 2026-08-06 đo được: **16 comment trong source trỏ vào thư mục docs/plans** — năm file kế
hoạch được viện dẫn như thẩm quyền thiết kế cho những phần khó nhất của app (vòng luyện sâu, chế độ
hội thoại, nhóm học, calibration thích ứng, vòng tutor tự chủ). Cộng thêm một file decisions ở gốc
docs (8 chỗ) và một file 00-map (3 chỗ).

`git log --all` cho các đường dẫn đó **trống**. Chúng chưa bao giờ được commit vào repo này — không
phải bị xoá, mà chưa từng có ở đây.

(Ba cái tên trên cố ý viết dưới dạng văn xuôi, không phải đường dẫn trong backtick: chúng không tồn
tại, nên viết như một đường dẫn thì chính ADR này trở thành một con trỏ chết — và phép kiểm ở cuối
tài liệu đã bắt đúng nó ở lần chạy đầu.)

Cùng lúc: `docs/specs/` và `docs/rubrics/` chỉ chứa `_TEMPLATE.md`, và `features/_index.json` chỉ có
một entry mẫu trỏ vào file không tồn tại. Tức là **mọi cơ chế ghi lại quyết định thiết kế trong repo
này đều trống**, trong khi code thì viết như thể chúng đầy.

Vì sao điều đó tệ hơn "thiếu tài liệu": với agent, mọi text trong repo có thẩm quyền như nhau và không
có trực giác "ghi chú này cũ rồi". Một con trỏ chết không báo lỗi — nó gửi người đọc tới chỗ trống, rồi
người đọc **tự nghĩ ra** nội dung đáng lẽ ở đó. Trong lúc sửa chính đợt này, agent đã tự bịa ra hai
phương án "đã bị loại" cho `lib/calibration.ts` mà không có bằng chứng nào; nó bị bắt và hoàn lại, và
đó chính là hành vi mà những con trỏ chết khuyến khích.

## Quyết định

1. **Comment trong code là thẩm quyền thiết kế của app này.** Một comment giải thích một lựa chọn phải
   TỰ ĐỨNG ĐƯỢC: nêu lý do ngay tại chỗ, không đẩy sang một file khác.
2. **Không viện dẫn tài liệu không tồn tại trong repo.** Không tái tạo `docs/plans/*` bằng cách suy
   diễn từ code — một tài liệu bịa ra tệ hơn không có tài liệu, vì nó có vẻ như bằng chứng.
3. **Không xoá thông tin khi bỏ con trỏ.** Nếu con trỏ mang theo lý lẽ duy nhất, chuyển lý lẽ đó thành
   prose tại chỗ. Nếu nó mang theo số mục ("step 2.1", "gate 1.4") thì số đó vô nghĩa khi không có tài
   liệu — bỏ số, giữ nội dung.
4. **Quyết định mới đi vào ADR trong `docs/adr/`**, không vào một thư mục plans không tồn tại.

## Cưỡng chế bằng máy

`tooling/entropy-scan.mjs` §9b: quét mọi đường dẫn mà tài liệu **và comment trong source** trỏ tới,
FAIL nếu không tồn tại. Loại trừ ba nguồn LỊCH SỬ (`HARNESS-CHANGELOG.md`, `.claude/learnings/**`,
`docs/progress/**`) vì chúng phải được phép nhắc file đã đổi tên hoặc đã mất.

Nghĩa là luật này không tồn tại dưới dạng lời nhắc: thêm lại một con trỏ chết thì phép kiểm đỏ.

## Hệ quả

- Comment ở 14 file dài hơn một chút. Đó là giá đúng: chỗ đọc code là chỗ cần lý do.
- Lý lẽ chi tiết trong năm plan doc kia **mất thật**, không khôi phục được. Những gì code còn nói
  được thì đã giữ; phần còn lại thì không ai có.
- Nếu sau này các plan doc đó xuất hiện (máy khác, repo khác), commit chúng vào `docs/adr/` hoặc
  `docs/specs/` rồi mới trỏ tới — lúc đó phép kiểm sẽ xanh vì file có thật.

## Điều kiện xét lại

Khi `docs/specs/` hoặc `docs/adr/` có đủ hồ sơ để một quyết định mới nên viết thành tài liệu riêng
thay vì comment. Lúc đó điểm 1 nên nới: comment trỏ tới ADR **đã commit** là hoàn toàn đúng.
