# Kế hoạch 7.2: mở đăng ký, trang quản trị, ứng dụng đã kết nối

- Ngày: 2026-10-27. Duyệt: thien, 2026-10-27 04:20 UTC (câu trả lời ở cuối file).
- Lộ trình: `docs/roadmap.md` mục 7.2 (gồm cả 4.2). Nối tiếp kế hoạch 7.1
  (`docs/plans/2026-10-25-phase7-1-per-user-data.md`) và quyết định 0006.

> **Đổi so với lộ trình:** roadmap ghi "sign-up that thien approves". thien chọn **mở đăng ký không cần duyệt**;
> anh chặn (ban) ai cũng được, bất cứ lúc nào.

## Tóm tắt

Sau 7.2, ai đăng nhập bằng Google cũng có tài khoản ngay, kèm một kho OpenJLPT mới tinh (Hán Việt đã duyệt,
chưa có lịch ôn). Họ học như anh và không thấy dữ liệu của anh. Anh có trang quản trị để chặn, bỏ chặn hoặc
xoá tài khoản. Sao lưu toàn bộ DB, khôi phục và thống kê công cụ MCP chỉ quản trị thấy. Cài đặt có thêm mục
"Ứng dụng đã kết nối" để xem và thu hồi Claude/ChatGPT đã được cấp quyền (4.2).

- Trước: chỉ `ALLOWED_EMAIL` vào được; tài khoản thứ hai bị chặn lúc tạo.
- Sau: `ALLOWED_EMAIL` là quản trị. Mọi tài khoản Google khác là người học, trừ khi bị chặn.

## Lỗ hổng phải bịt trước khi mở cửa

Đọc code hôm nay, các chỗ này chỉ hỏi "đã đăng nhập chưa", không hỏi "là ai":

| Chỗ | Hôm nay | Sau 7.2 |
| --- | --- | --- |
| `GET /api/backup` | ai đăng nhập cũng tải được **toàn bộ DB** | chỉ quản trị |
| `POST /api/import/system` | ai đăng nhập cũng khôi phục đè được cả hệ thống | chỉ quản trị |
| Thẻ "Dùng MCP" trong Cài đặt (`readToolUsage`) | ai cũng thấy | chỉ quản trị |
| Khôi phục: so email (`reconcileUsersByEmail`) | phân biệt hoa thường, có thể tạo tài khoản trùng | so không phân biệt hoa thường |
| `lib/import/hanviet-fill.ts` | tìm Item theo id cố định của OpenJLPT | tìm theo (userId, kind, expression) |
| `GET /api/tts` | không cần đăng nhập: ai trên mạng cũng dùng được VOICEVOX trên NUC | cần một tài khoản không bị chặn |

## Vai trò

Dùng cột `role` và `banned` sẵn có trên bảng `user` (plugin admin của better-auth), **không đổi schema**:

| Tài khoản | Ai | Được làm gì |
| --- | --- | --- |
| `role = admin` | `ALLOWED_EMAIL` | mọi thứ, cộng trang quản trị, sao lưu, khôi phục, thống kê MCP |
| `role = user` | mọi tài khoản Google khác | học, nối Claude (OAuth hoặc khoá MCP), xuất và nhập dữ liệu **của mình** |
| `banned = true` | bị anh chặn | không có phiên, phiên đang mở và token MCP cũ hỏng ngay |

Một hàm thuần duy nhất `accountAccess(user)` trả về `admin | learner | none`, có test riêng. Mọi cửa vào gọi
nó: trang và action (`getSessionUserId`), route API, route MCP (khoá MCP và token OAuth), trang `/consent`.
Thiếu `role` hay giá trị lạ thì là `none` (đóng khi không chắc). Không ai tự đổi được `role` của mình; chỉ
trang quản trị ghi `banned`.

## Đăng ký

1. Người mới bấm "Đăng nhập bằng Google". Tài khoản được tạo với `role = user`; email `ALLOWED_EMAIL` thì
   thành `admin` như hôm nay.
2. Ngay sau khi tạo, người đó nhận kho OpenJLPT (khoảng 8.000 mục, mỗi mục một SrsState mới, id mới), trong một
   transaction. Kho dựng từ file trong `data/openjlpt/` bằng chính hàm đang dựng file nhập hôm nay, **không
   chép từ kho của anh**, nên ghi chú, sao, thẻ giải thích của anh không lọt sang. Nếu bước này lỗi, lần vào
   trang chủ kế tiếp sẽ dựng lại (hàm chạy lại an toàn: bỏ qua mục đã có).
3. Giới hạn: tối đa `MAX_ACCOUNTS` tài khoản (mặc định 50, đổi bằng biến môi trường). Quá thì đăng ký mới báo
   "sakubun đã đủ người dùng." Mỗi người khoảng vài MB, nên 50 người vẫn nhẹ cho NUC; giới hạn để chặn ai đó
   tạo hàng loạt tài khoản Google làm đầy ổ.

## Trang quản trị `/admin`

Danh sách tài khoản: email, ngày tạo, lần ôn cuối, số mục, trạng thái. Mỗi người có:

- **Chặn / Bỏ chặn** (mặc định khi muốn đuổi ai): giữ tài khoản và dữ liệu, người đó không vào được nữa.
- **Xoá tài khoản**: nút riêng, phải gõ lại email để xác nhận; xoá luôn dữ liệu học của người đó (quyết định
  0006). Không xoá được tài khoản quản trị.

## Ứng dụng đã kết nối (4.2)

Mục mới trong Cài đặt: các ứng dụng (claude.ai, ChatGPT, …) mà người đó đã cấp quyền qua OAuth, ngày cấp,
lần dùng cuối. Nút "Thu hồi" xoá consent và refresh token của ứng dụng đó cho người đó. Test: ứng dụng bị thu
hồi nhận 401 ở lần refresh tiếp theo (điều kiện "Done when" của 4.2).

## Chia PR

| PR | Nội dung | Rủi ro | Ai merge |
| --- | --- | --- | --- |
| 7.2a | Bịt lỗ hổng: backup, khôi phục, thống kê MCP chỉ quản trị; so email không phân biệt hoa thường; TTS cần đăng nhập; `accountAccess()` + test, mọi cửa vào gọi nó | cao | anh |
| 7.2b | `seedStarterDeck(db)` dựng kho OpenJLPT cho một người, id mới, chạy lại an toàn; `hanviet-fill` theo (kind, expression) thay vì id; test với hai người (chưa nối vào app) | thấp | AI |
| 7.2c | Trang `/admin`: danh sách, chặn, bỏ chặn, xoá | cao | anh |
| 7.2d | Mở đăng ký: `role = user`, dựng kho khi tạo tài khoản, `MAX_ACCOUNTS`. Sửa CLAUDE.md và quyết định 0006 | cao | anh |
| 7.2e | Ứng dụng đã kết nối trong Cài đặt (4.2) | cao | anh |

Thứ tự: 7.2a, 7.2b, 7.2c trước (chưa ai khác vào được nên an toàn); 7.2d mở cửa cuối cùng, khi anh đã có chỗ
chặn. Trang mới (`/admin`, mục mới trong Cài đặt) theo quy trình bước 6: ảnh 1440 và 390, anh duyệt ảnh rồi
mới merge.

Không có migration đụng dữ liệu học, nên không cần sao lưu NUC riêng cho 7.2; poller vẫn tự chụp trước mỗi lần
kéo bản mới.

## Test chứng minh ("Done when": người thứ hai học mà không thấy người thứ nhất)

1. `accountAccess()`: bảng đủ mọi tổ hợp role/banned, giá trị lạ thì `none`.
2. Người bị chặn: mọi trang chuyển về `/login`; route API trả 401; khoá MCP và token OAuth bị từ chối, kể cả
   token cấp trước khi bị chặn.
3. Người `user`: `/api/backup`, `/api/import/system`, `/admin` trả 403; không thấy thẻ "Dùng MCP".
4. Đăng ký: người mới có đúng số mục OpenJLPT, không id nào trùng với của anh, không ghi chú nào của anh; tài
   khoản thứ `MAX_ACCOUNTS + 1` bị từ chối.
5. e2e: tài khoản thứ hai đăng ký, ôn một lượt; tài khoản của anh không đổi gì; anh chặn người đó và họ bị
   đẩy ra.

## Ngoài code

Nếu ứng dụng OAuth của sakubun trên Google Cloud Console đang ở chế độ "Testing", chỉ email trong danh sách
test users đăng nhập được. Muốn ai cũng đăng ký được thì anh chuyển sang "In production" trước khi 7.2d lên.

## Anh đã trả lời (27/10, 04:20 UTC)

1. Ai được đăng ký: mọi tài khoản vào được mà không cần duyệt; anh có thể chặn bất cứ lúc nào.
2. Người mới bắt đầu với: kho OpenJLPT mới.
3. Đuổi người: theo đề xuất (chặn là mặc định, xoá là nút riêng có xác nhận).
