# Sakubun: nick này đang có gì (13/11/2026)

Viết bởi Claude ở project "Sakubun", thread "Đọc bàn giao và làm tiếp Sakubun", lúc 22:30 ngày 13/11.

Phiên viết: `session_01LiS5Xq1yVMXYH8kdmrtpPz` (cùng tài khoản đã mở #287, #288, #289, #291–#294). Nick khác viết bản của mình cạnh file này để thien so sánh.
Nhãn: [Fact] là mình đã kiểm bằng công cụ (GitHub, file trong repo); [Suy luận] là mình đoán từ những gì thấy.

## Đọc trong 2 phút

- **Sakubun chưa thật sự theo quy trình chung.** Repo có tên trong danh sách đồng bộ của thienai-workflow từ 05/11, nhưng `main` vẫn chưa có các file của quy trình chung [Fact]:
  - không có `AGENTS.md`;
  - `CLAUDE.md` không có dòng `@AGENTS.md`;
  - không có `scripts/check-status.mjs`.

  Vì vậy các luật chung ("Nhắc việc dở", bảng "Việc dở", "Cuối phiên", trang tiến độ) chưa bao giờ vào được sakubun. Mỗi nick chỉ làm theo luật riêng trong `CLAUDE.md` và `docs/handoff.md` của sakubun.

- **`docs/STATUS.md` trên main đã cũ.** File được sửa lần cuối ngày 10/11 và vẫn ghi "U1 còn lại" [Fact]. Việc U2 chỉ được nhận trong PR #288, mà PR này chưa merge. Nên nick khác nhìn vào main sẽ không thấy ai đang giữ U2.
- **Sakubun đang có 6 PR mở, đều do nick này mở hôm nay** [Fact]:
  - #288: kế hoạch U2 và đánh dấu U1 xong;
  - #289: đóng câu hỏi nghiên cứu;
  - #291 đến #294: U2a đến U2d, xếp chồng lên nhau, mỗi PR dựa trên PR trước.

  Cả 6 PR đều chưa merge.

- **Bố cục buổi ôn:** tối nay bạn bác kiểu buổi ôn chiếm cả màn hình. Mình đã sửa #291 để buổi ôn giữ sidebar, thanh tab và khung rộng như các trang khác, rồi đẩy thay đổi lên #292 đến #294. Ảnh duyệt chưa chụp lại.
- **Đề xuất của mình:** dừng làm tính năng cho đến khi hai nick thống nhất một chỗ ghi trạng thái duy nhất trong repo.

## 1. Các thread của project Sakubun ở nick này

Nick này chỉ thấy thread trong project Sakubun. Thread ở project khác (TikTok, môn học...) mình không đọc được.

| Thread                                             | Trạng thái                     | Kết quả                                                                                     |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| Đọc bàn giao và làm tiếp Sakubun (thread này)      | Đang làm, đã dừng theo lời bạn | U1 (#276–#287, đã merge), kế hoạch U2 #288, U2a–U2d #291–#294 (mở, phiên khác đã review OK) |
| Nghiên cứu và đề xuất tính năng Sakubun            | Chờ bạn chọn bước tiếp         | #232 đã merge; #289 mở. Thẻ chọn: quy trình 2 (luật làm việc) / R6 gia sư / chờ UI v2       |
| Review giao diện U2a; Review giao diện U2b đến U2d | Xong                           | Đăng review "Review: OK" lên #291–#294                                                      |
| Cải thiện workflow AI từ review của Codex (12/11)  | Xong                           |                                                                                             |
| Hoàn thiện Kaiwa, ưu tiên chia sẻ hội thoại        | Xong                           | #234–#239                                                                                   |
| Làm lại Ôn nhanh                                   | Xong                           | #171–#200                                                                                   |
| Hoàn thiện các phần Sakubun còn dở                 | Xong                           | #228–#230                                                                                   |
| Làm lại giao diện Hội thoại và Kho chung (7.4)     | Xong                           | #181–#212                                                                                   |
| Review PR chuỗi ngày và status MCP                 | Xong                           |                                                                                             |
| Đưa Kaiwa và Kho chung lên NUC                     | Xong                           |                                                                                             |
| Xây Kaiwa canvas và kho chung                      | Xong                           | #159–#169                                                                                   |

**Đang chờ bạn ở nick này** [Fact]:

1. Duyệt ảnh U2a–U2d. Cần chụp lại sau thay đổi bố cục tối nay.
2. Thẻ chọn U2e (chấm thẻ chạy nền) và U2f (hoàn tác).
3. Thẻ chọn bước tiếp của phần nghiên cứu.
4. Hai việc trong STATUS:
   - bấm Hiện "N5 · Ngữ pháp" ở trang Quản trị;
   - thử chia sẻ kịch bản bằng tài khoản thứ hai (`kai`).

## 2. Repo sakubun lúc này

- **`main`** đang ở #290 (bản bàn giao của nick khác, merge 11:50 hôm nay). Trước đó là #287 (sửa theo góp ý cổng U1).
- **Ai mở PR nào** [Fact, đối chiếu mã phiên trong mô tả PR]:
  - nick này mở #287, #288 và #291 đến #294;
  - một thread khác của nick này mở #289;
  - #290 do một phiên ở tài khoản khác mở.
- **Nhánh còn trên GitHub:** 21 nhánh. Trong đó có các nhánh cũ đáng dọn:
  - `claude/project-thread-*`;
  - `data/kanji-meanings-2` đến `data/kanji-meanings-6`;
  - `feat/multiuser-community`;
  - `feat/u1-*`;
  - `docs/ui-v2-plan`.
- **Lộ trình (`docs/roadmap.md` trên main):**
  - U0: Done;
  - U1: vẫn ghi "In progress", dù bạn đã cho qua;
  - U2 đến U8: Not started.
- **Kế hoạch:** nằm trong `docs/plans/`. Các kế hoạch này không theo mẫu `PLAN.template.md` (không có ô tick checkpoint, không có mục "Đang ở đâu"), và không có trang tiến độ.

## 3. Thứ chỉ nằm trong bộ nhớ project của nick này, chưa có trong repo

Nick khác sẽ không biết những điều sau, trừ khi chúng được ghi vào repo:

- **Hồ sơ người học của bạn:** đỗ N3 tháng 7 (117/180), thi N2 tháng 12, yếu nghe và nói, học thất thường. Một phần đã có ở `docs/plans/2026-11-04-feature-candidates.md`.
- **Hướng sản phẩm:** Sakubun cho nhiều người học Việt, có thể thu phí. Không dùng AI phía server cho tới khi có gói trả phí. Không có dữ liệu nào phải giữ.
- **Việc Kaiwa còn lại:** tìm kịch bản qua MCP, karaoke theo âm tiết, giọng riêng cho từng vai, lưu buổi nhập vai. Bạn sẽ chọn thứ tự.
- **Mẹo khi làm:**
  - cách chạy e2e trên cloud;
  - chế độ tự động chặn Claude merge nếu bạn không nói "merge đi" trong thread;
  - NUC tự deploy khoảng 2 phút sau khi merge.

## 4. Chỗ lệch giữa cách hai nick làm và quy trình chung

| Quy trình chung nói                                                                         | Sakubun đang làm                                                                                                       | Hậu quả                                                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Repo là nguồn sự thật duy nhất; trạng thái nằm ở `docs/STATUS.md`                           | Trạng thái nằm rải ở STATUS (cũ), `docs/handoff.md`, PR chưa merge, bộ nhớ project và thread                           | [Suy luận] Hai nick đọc hai bức tranh khác nhau. Bạn phải tự chuyển lời giữa hai bên ("chờ nick kia bàn giao"). |
| STATUS có bảng "Việc dở" và "Kế hoạch đang chạy"; CI kiểm tối đa 40 dòng, tối đa 3 việc chờ | STATUS dùng mục riêng ("U1 còn lại", "Việc nhỏ còn treo"), không có bảng "Đang làm" như `CLAUDE.md` đòi, CI không kiểm | Không biết ai đang giữ bước nào                                                                                 |
| Nhắc việc dở trước khi làm việc mới                                                         | Không có luật này trong sakubun                                                                                        | Việc dở chồng lên nhau: 6 PR mở, 3 thẻ chọn chờ                                                                 |
| Làm màn hình: AI đưa 2–3 bố cục, bạn chọn trước rồi mới code                                | U2 code thẳng theo kế hoạch UI v2 (dòng "Phiên học: không sidebar, không thanh tab")                                   | Bạn chỉ thấy bố cục khi đã có 4 PR, rồi bác (tối nay)                                                           |
| Không muốn duyệt nhiều PR nhỏ liên tiếp; việc nhỏ duyệt một lần                             | U2 chia thành 4 PR xếp chồng, mỗi PR có một trang duyệt ảnh riêng                                                      | Nhiều việc phải duyệt cùng lúc                                                                                  |
| Kế hoạch có trang tiến độ xem được trên điện thoại                                          | Không có trang tiến độ cho sakubun                                                                                     | Bạn mất dấu tiến độ (chính bạn nói tối nay)                                                                     |

## 5. Đề xuất cho bước lên kế hoạch lại (chờ so với nick kia)

1. **Áp quy trình chung vào sakubun, một PR:**
   - tạo `AGENTS.md` từ mẫu, với phần riêng ghi "Luật riêng ở `CLAUDE.md`, đọc trước";
   - thêm dòng `@AGENTS.md` vào đầu `CLAUDE.md`;
   - viết lại `docs/STATUS.md` theo mẫu, gồm bảng "Việc dở" và "Kế hoạch đang chạy" (mỗi việc kèm nick và nhánh đang giữ);
   - thêm `scripts/check-status.mjs` vào CI.

   Gộp `docs/handoff.md` vào STATUS và `CLAUDE.md`, rồi xoá file đó, để chỉ còn một chỗ.

2. **Chép từ bộ nhớ của nick này vào repo** những gì nêu ở mục 3, để nick nào mở repo cũng thấy.
3. **Một nick giữ một việc.** Nhận việc bằng một dòng trong STATUS trên `main`, không phải trong PR chưa merge.
4. **Với U2:** bạn chọn bố cục buổi ôn trước, từ 2–3 phương án có ảnh. Sau đó gộp U2a–U2d thành ít PR hơn, một lần duyệt ảnh.

Lý do mạnh nhất để không làm ngay bước 1: nó thêm một PR nữa trong lúc đã có 6 PR mở. Nếu bạn muốn, có thể merge hoặc đóng #288 và #289 trước để giảm số việc treo.
