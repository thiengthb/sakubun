# Kế hoạch 7.1: dữ liệu học theo từng người

- Ngày: 2026-10-25. Duyệt: thien, 2026-10-25 22:13 (câu trả lời ở cuối file).
- Bản gốc: artifact `claude.ai/artifact/8dhCRanXdgsiDFTJBbUHdf` (chỉ mở được từ tài khoản Claude đã tạo nó).
  File này là bản chép vào repo để mọi tài khoản Claude đọc được. Khi hai bản khác nhau, file này đúng.
- Quyết định: `docs/decisions/0006-per-user-learning-data.md`.

> **Lệch so với kế hoạch khi làm:** 7.1a thêm `userId` dạng **nullable** (expand, then contract) thay vì
> bắt buộc ngay; 7.1d mới làm cột bắt buộc và đổi khoá trùng của Item. 7.1b và 7.1c gộp một PR (#131),
> lý do trong mô tả PR. Xem decision 0006.

## Tóm tắt

7.1 gắn mọi dữ liệu học vào một tài khoản (`userId`), chuyển toàn bộ dữ liệu hiện có sang tài khoản của anh,
và thêm một bộ gác làm mọi truy vấn thiếu `userId` hỏng ngay. Sau 7.1 app vẫn chỉ cho mình anh đăng nhập.
Mở đăng ký là việc của 7.2.

- Trước: dữ liệu học không có chủ. Ranh giới duy nhất là đăng nhập (`ALLOWED_EMAIL`).
- Sau: mỗi dòng Item, SrsState, ReviewLog, Sentence, Turn, Group, GroupMember và Settings đều có `userId`.
  Code chỉ đọc và ghi được qua một client đã gắn sẵn người dùng.
- Anh cần quyết: mục học (Item) là riêng từng người hay một kho chung (phần dưới). Em đề xuất riêng từng người.

## Quyết định: mục học riêng hay kho chung

Em đề xuất mỗi người một kho mục riêng. Kế hoạch ngày 24/10 ghi "kho OpenJLPT dùng chung", nhưng khi đọc lại
code thì một Item mang cả dữ liệu riêng của người học: tạm ngưng, gắn sao, ghi chú, và thẻ giải thích mà
Claude của chính người đó điền.

|                           | Kho riêng từng người (đề xuất)                                               | Kho chung + bảng riêng cho phần cá nhân                             |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Schema                    | Thêm `userId` vào Item, giữ nguyên các cột                                   | Tách Item thành kho chung + UserItem (tạm ngưng, sao, ghi chú, thẻ) |
| Code phải sửa             | Chỉ thêm điều kiện người dùng                                                | Viết lại mọi truy vấn Item (khoảng 50 chỗ)                          |
| Bộ gác                    | Một luật cho mọi bảng: thiếu `userId` là lỗi                                 | Hai loại bảng, dễ lọt                                               |
| Người mới                 | Được chép kho OpenJLPT (kèm Hán Việt đã duyệt) lúc anh duyệt tài khoản (7.2) | Thấy ngay kho chung                                                 |
| Dung lượng                | Khoảng 8.000 dòng mỗi người, vài MB                                          | Ít hơn                                                              |
| Sửa một lỗi trong kho gốc | Phải chạy migration cho mọi người                                            | Sửa một chỗ                                                         |

Với vài người dùng trên một NUC, phần tốn dung lượng không đáng kể, còn bộ gác đơn giản thì quan trọng hơn.
Nếu sau này có nhiều người, vẫn tách ra kho chung được.

## Schema và chuyển dữ liệu

Một migration thêm cột `userId` (bắt buộc, trỏ về bảng `user`, xoá tài khoản thì xoá theo) vào 8 bảng học,
rồi gán mọi dòng hiện có cho tài khoản duy nhất đang có, tức tài khoản của anh.

| Bảng               | Thay đổi ngoài `userId`                                            |
| ------------------ | ------------------------------------------------------------------ |
| Item               | Khoá trùng đổi từ (loại, biểu thức) thành (người, loại, biểu thức) |
| SrsState           | Chỉ mục (userId, due) cho hàng đợi ôn                              |
| ReviewLog          | Chỉ mục (userId, reviewedAt) cho Phân tích và chuỗi ngày           |
| Sentence, Turn     | Chỉ mục (userId, createdAt) cho Lịch sử                            |
| Group, GroupMember | Không                                                              |
| Settings           | Mỗi người một dòng (`userId` duy nhất)                             |

Giữ nguyên: McpToolCall (thống kê công cụ cho quản trị), McpKey và các bảng OAuth (đã gắn người dùng).

An toàn dữ liệu:

1. Migration chỉ cộng thêm, không xoá cột hay dòng nào.
2. Một test migration chạy trên bản sao DB có dữ liệu. Test kiểm tra số dòng mỗi bảng giữ nguyên, mọi dòng
   đều có chủ, và lịch FSRS giữ nguyên từng giây. Test này theo mẫu của `turn-migration.test.ts`.
3. Trước khi merge, anh sao lưu DB trên NUC. Poller cũng tự chụp `sakubun_data` trước khi kéo bản mới.

## Bộ gác truy vấn

Code học không còn dùng client Prisma trần. Nó dùng `userDb(userId)`, một client Prisma mở rộng tự thêm
`userId` vào mọi truy vấn trên 8 bảng học. Client trần thì ném lỗi ngay khi chạm vào các bảng đó. Quên gắn
người dùng sẽ thành lỗi, không bao giờ thành lộ dữ liệu.

- Đọc, sửa, xoá (find, count, groupBy, update, delete): thêm `userId` vào where. Một dòng của người khác trả
  về như không tồn tại.
- Tạo (create, createMany, upsert): điền `userId` vào dữ liệu. Ghi lồng nhau mà thiếu `userId` thì hỏng vì
  cột bắt buộc, nên test sẽ bắt được ngay.
- SQL viết tay (`$queryRaw`, `$executeRaw`, hiện có 23 chỗ kể cả transaction): một test quét code, chỉ cho
  phép trong `lib/db` và phần nhập bản sao lưu. Chỗ nào còn lại thì chuyển sang client đã gác.
- Người dùng đến từ đâu: trang và action gọi `await userDbFromSession()`. Không có phiên thì chuyển về
  `/login`. Route MCP lấy người dùng từ token OAuth hoặc khoá MCP. Các hàm trong `lib/` nhận client làm tham
  số đầu tiên, không tự đọc phiên.
- `recordReviews()` vẫn là lối duy nhất ghi lịch FSRS, giờ nhận thêm client của người dùng.

Test chứng minh bộ gác hoạt động:

1. Client trần chạm vào từng bảng trong 8 bảng đều phải ném lỗi.
2. Test rò rỉ: tạo hai người A và B cùng kho, lịch ôn, nhóm và lượt ôn. Chạy mọi hàm đọc (hàng đợi, Ôn nhanh,
   Phân tích, Lịch sử, Tài nguyên, Nhóm, xuất file, công cụ MCP) dưới tên B. Không một id nào của A được xuất
   hiện.
3. B sửa hoặc xoá một mục của A bằng id thì không đổi gì, và nhận lỗi "không tìm thấy".

## Chia PR

Bốn PR theo thứ tự. Mỗi PR đều để app chạy được và anh không thấy gì khác khi dùng.

| PR   | Nội dung                                                                                                         | Rủi ro | Ai merge                 |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------ | ------------------------ |
| 7.1a | Schema + migration + test migration. Sửa dòng "dữ liệu học không có userId" trong CLAUDE.md. Ghi quyết định 0006 | cao    | anh, sau khi sao lưu NUC |
| 7.1b | `userDb` + bộ gác + test bộ gác. Chuyển `lib/app` và các công cụ MCP sang client đã gác                          | cao    | anh                      |
| 7.1c | Chuyển phần còn lại: kho, nhóm, Phân tích, Lịch sử, xuất và nhập. Test rò rỉ với hai người dùng                  | cao    | anh                      |
| 7.1d | Bật chế độ ném lỗi cho client trần, test quét SQL viết tay                                                       | cao    | anh                      |

Sau mỗi PR, em chạy `npm run verify` và toàn bộ e2e. Đến 7.1d thì mọi bảng học đều đã qua bộ gác. Khi đó 7.2
(đăng ký có duyệt, trang quản trị, mục 4.2) mới mở được cho người khác.

Rủi ro chính là một truy vấn lọt khỏi bộ gác và đọc dữ liệu của người khác. Hai lớp chặn điều này: client trần
ném lỗi, và test rò rỉ chạy mọi hàm đọc. Trong lúc 7.1 đang làm, chỉ có một tài khoản nên chưa thể lộ gì.

## Anh đã trả lời (25/10, 22:13)

Anh duyệt kế hoạch. Em bắt đầu 7.1a.

1. Mục học: riêng từng người.
2. Làm trên repo sakubun hiện tại.
3. Thống kê công cụ MCP: chung, chỉ quản trị thấy. Phần sao lưu DB trong Cài đặt cũng chỉ quản trị thấy.

## Thêm sau 7.1

- Sao lưu: sao lưu và khôi phục vẫn là sao lưu toàn bộ DB, và chỉ quản trị dùng được. Bước "sao lưu theo từng
  người" (7.3 trong kế hoạch ngày 24/10) được bỏ. Vai trò quản trị (`role` trên bảng `user`) vào 7.2, cùng
  trang quản trị. Từ giờ đến 7.2 chỉ có một tài khoản, nên tài khoản đó là quản trị.
- Trang Hướng dẫn: đưa lại trang `/guide` mà anh đã xoá ngày 14/8 (6 commit `chore(guide)`), nhưng viết lại
  theo app hiện tại: cách học, cách kết nối Claude qua MCP, và phần tra cứu công cụ.
- Giao diện: khi phần backend (7.1, 7.2) xong, mỗi trang mới hoặc trang phải đổi (đăng ký, chờ duyệt, quản trị,
  Hướng dẫn, Cài đặt khi không phải quản trị) đi một PR riêng theo quy trình bước 6: ảnh trước và sau ở 1440
  và 390, anh duyệt rồi mới merge.
