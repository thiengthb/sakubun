# Kế hoạch 7.2: đăng ký có duyệt, trang quản trị, ứng dụng đã kết nối

- Ngày: 2026-10-27. **Trạng thái: chờ thien duyệt.** Khi duyệt, ghi câu trả lời vào cuối file trong cùng PR
  bắt đầu code, rồi mới code.
- Lộ trình: `docs/roadmap.md` mục 7.2 (gồm cả 4.2). Nối tiếp kế hoạch 7.1
  (`docs/plans/2026-10-25-phase7-1-per-user-data.md`) và quyết định 0006.

## Tóm tắt

Sau 7.2, một người khác đăng nhập bằng Google thì có tài khoản ở trạng thái **chờ duyệt**: họ chỉ thấy trang
"Đang chờ duyệt", chưa học, chưa nối được Claude. Anh duyệt ở trang quản trị; lúc duyệt, người đó được chép
kho OpenJLPT mới tinh (Hán Việt đã duyệt, chưa có lịch ôn). Từ đó họ học như anh, không thấy dữ liệu của anh.
Sao lưu toàn bộ DB, khôi phục và thống kê công cụ MCP chỉ quản trị thấy. Cài đặt có thêm mục "Ứng dụng đã
kết nối" để xem và thu hồi Claude/ChatGPT đã được cấp quyền (4.2).

- Trước: chỉ `ALLOWED_EMAIL` vào được; tài khoản thứ hai bị chặn lúc tạo.
- Sau: `ALLOWED_EMAIL` vẫn là quản trị (tự duyệt). Mọi tài khoản Google khác vào hàng chờ, anh quyết.

## Lỗ hổng phải bịt trước khi mở cửa

Đọc code hôm nay, các chỗ này đang chỉ hỏi "đã đăng nhập chưa", không hỏi "là ai":

| Chỗ | Hôm nay | Sau 7.2 |
| --- | --- | --- |
| `GET /api/backup` | ai đăng nhập cũng tải được **toàn bộ DB** | chỉ quản trị |
| `POST /api/import/system` | ai đăng nhập cũng khôi phục đè được cả hệ thống | chỉ quản trị |
| Thẻ "Dùng MCP" trong Cài đặt (`readToolUsage`) | ai cũng thấy | chỉ quản trị |
| Khôi phục: so email (`reconcileUsersByEmail`) | phân biệt hoa thường, có thể tạo tài khoản trùng | so không phân biệt hoa thường |
| `lib/import/hanviet-fill.ts` | tìm Item theo id cố định của OpenJLPT | tìm theo (userId, kind, expression) |

## Trạng thái tài khoản

Dùng cột `role` sẵn có trên bảng `user` (plugin admin của better-auth), **không đổi schema**:

| `role` | Ai | Được làm gì |
| --- | --- | --- |
| `admin` | `ALLOWED_EMAIL` | mọi thứ, cộng trang quản trị, sao lưu, khôi phục, thống kê MCP |
| `user` | người anh đã duyệt | học, nối Claude (OAuth hoặc khoá MCP), xuất và nhập dữ liệu **của mình** |
| `pending` | mới đăng ký | chỉ trang "Đang chờ duyệt" và đăng xuất |
| `banned = true` | bị chặn | không có phiên, token MCP cũ hỏng ngay |

Một hàm thuần duy nhất `accountAccess(user)` trả về `admin | learner | pending | none`, có test riêng. Mọi
cửa vào gọi nó: trang và action (`getSessionUserId`), route API, route MCP (khoá MCP và token OAuth), trang
`/consent`. Thiếu `role` hay giá trị lạ thì là `none` (đóng khi không chắc).

## Luồng đăng ký và duyệt

1. Người mới bấm "Đăng nhập bằng Google". Tài khoản được tạo với `role = pending`. Email `ALLOWED_EMAIL` thì
   thành `admin` như hôm nay.
2. Họ thấy trang `/pending`: "Tài khoản đang chờ duyệt", kèm email của họ và nút đăng xuất.
3. Anh mở `/admin`: danh sách tài khoản (email, ngày tạo, trạng thái, số mục, lần ôn cuối). Nút cho mỗi
   người: **Duyệt**, **Chặn / Bỏ chặn**, **Xoá tài khoản** (gõ lại email để xác nhận; xoá luôn dữ liệu học
   của người đó theo quyết định 0006).
4. Bấm Duyệt: trong một transaction, `role` thành `user` và người đó nhận kho OpenJLPT (khoảng 8.000 mục, mỗi
   mục một SrsState mới, id mới). Kho được dựng từ file trong `data/openjlpt/` bằng chính hàm đang dựng file
   nhập hôm nay, **không chép từ kho của anh**, nên ghi chú, sao, thẻ giải thích của anh không lọt sang.
5. Thanh điều hướng của anh có chấm báo khi có người chờ duyệt. Không gửi email.

Giới hạn: tối đa 20 tài khoản chờ duyệt cùng lúc; quá thì đăng ký mới báo "Đang có quá nhiều yêu cầu, thử lại
sau." (chặn ai đó tạo hàng loạt tài khoản Google làm đầy DB).

## Ứng dụng đã kết nối (4.2)

Mục mới trong Cài đặt: các ứng dụng (claude.ai, ChatGPT, …) mà người đó đã cấp quyền qua OAuth, ngày cấp,
lần dùng cuối. Nút "Thu hồi" xoá consent và refresh token của ứng dụng đó cho người đó. Test: ứng dụng bị thu
hồi nhận 401 ở lần refresh tiếp theo (điều kiện "Done when" của 4.2).

## Chia PR

| PR | Nội dung | Rủi ro | Ai merge |
| --- | --- | --- | --- |
| 7.2a | Bịt lỗ hổng: backup, khôi phục, thống kê MCP chỉ quản trị; so email không phân biệt hoa thường; `hanviet-fill` theo (userId, kind, expression); `accountAccess()` + test | cao | anh |
| 7.2b | Hàm `seedStarterDeck(db)` dựng kho OpenJLPT cho một người, id mới, test với hai người (chưa nối vào app) | thấp | AI |
| 7.2c | Mở đăng ký: `role = pending`, trang `/pending`, mọi cửa vào gọi `accountAccess()`, giới hạn 20 chờ duyệt. Sửa CLAUDE.md (bỏ "chưa mở đăng ký") | cao | anh |
| 7.2d | Trang `/admin`: danh sách, duyệt (gọi `seedStarterDeck`), chặn, xoá. Chấm báo trên thanh điều hướng | cao | anh |
| 7.2e | Ứng dụng đã kết nối trong Cài đặt (4.2) | cao | anh |

Thứ tự: 7.2a và 7.2b trước (chưa ai khác vào được nên an toàn). 7.2c chỉ merge cùng lúc hoặc sau 7.2d, để
lúc có người chờ thì anh đã có chỗ duyệt. Trang mới (`/pending`, `/admin`, mục mới trong Cài đặt) theo quy
trình bước 6: ảnh 1440 và 390, anh duyệt ảnh rồi mới merge.

Không có migration đụng dữ liệu học (chỉ ghi `role` của tài khoản sẵn có là `admin`, đã đúng từ trước), nên
không cần sao lưu NUC riêng cho 7.2; poller vẫn tự chụp trước mỗi lần kéo bản mới.

## Test chứng minh ("Done when": người thứ hai học mà không thấy người thứ nhất)

1. `accountAccess()`: bảng đủ mọi tổ hợp role/banned, giá trị lạ thì `none`.
2. Người `pending`: mọi trang chuyển về `/pending`; route API trả 403; khoá MCP và token OAuth bị từ chối;
   `/consent` không cấp được quyền.
3. Người `user`: `/api/backup`, `/api/import/system`, `/admin` trả 403; không thấy thẻ "Dùng MCP".
4. Duyệt: người mới có đúng số mục OpenJLPT, không id nào trùng với của anh, không ghi chú nào của anh.
5. e2e: tài khoản thứ hai đăng ký, chờ, được duyệt, ôn một lượt; tài khoản của anh không đổi gì.

## Anh cần quyết

1. **Ai được đăng ký?** Đề xuất: mọi tài khoản Google, vào hàng chờ, anh duyệt từng người. Cách khác: chỉ
   email có trong một danh sách anh nhập trước (không có hàng chờ).
2. **Người mới bắt đầu với gì?** Đề xuất: kho OpenJLPT mới tinh lúc duyệt (như kế hoạch 7.1). Cách khác: kho
   trống, tự nhập.
3. **Từ chối thì sao?** Đề xuất: "Chặn" là mặc định (giữ tài khoản, không vào được), "Xoá" là nút riêng có
   xác nhận. Cách khác: từ chối là xoá luôn.

Ngoài code, anh cần kiểm một việc trên Google Cloud Console: nếu ứng dụng OAuth của sakubun đang ở chế độ
"Testing", chỉ những email trong danh sách test users đăng nhập được. Muốn người lạ đăng ký thì phải chuyển
sang "In production" (hoặc thêm từng email vào test users).
