# Một câu bình luận sai đủ sức trở thành kiến trúc

2026-08-12 · từ việc nâng thẻ enrichment cho từ vựng.

Người dùng nói "phần enrich của từ vựng hơi yếu kém". Tôi đoán sẽ phải nâng chất lượng nội dung —
thêm trường, siết thước đo. Thứ thật sự tìm thấy khác hẳn: **thẻ từ vựng chưa bao giờ được vẽ ra trên
web.** Claude soạn, DB lưu, không màn hình nào đọc. Không phải thẻ mỏng; là đường ống bị cắt.

Và ba chỗ trong repo nói ra thành lời cái niềm tin đã cắt nó:

- `items-table.tsx`: `{/* Riêng của bảng ngữ pháp — từ vựng không có thẻ chi tiết. */}`
- `library-health.ts`: `/** … (vocab cards are not part of the enrichment contract). */`
- `e2e/resources-tables.spec.ts`: `expect(…'Mọi mục').toHaveCount(0)` — một test GHIM niềm tin đó lại.

Không câu nào trong ba câu đó đúng: `Item.enrichment` không có ràng buộc kind, `enrich_items` nhận
itemId của từ vựng và ghi bình thường. Chúng là **giả định của người viết ngày đó**, viết ra dưới dạng
lời khẳng định. Rồi mỗi tính năng sau đọc câu đó như một sự thật và cẩn thận đi vòng qua nó. Cuối cùng
một cái test đứng ra bảo vệ nó.

**Bài học.** Khi một bình luận nói "X không có Y", hỏi ngay: đó là *quyết định* hay là *đo được*? Nếu
là quyết định thì nó phải nêu lý do; nếu không nêu lý do được thì nó là một giả định đang giả dạng
hợp đồng. Ba câu trên đều không nêu lý do.

**Cách phát hiện rẻ tiền:** grep phủ định trong bình luận (`không có`, `not part of`, `only for`) rồi
đối chiếu với LƯỢC ĐỒ. Lược đồ không biết những câu đó tồn tại.

Liên quan: `lib/turn-labels.ts` (một phép ánh xạ có hai bản là một bản sẽ bị quên) — cùng một họ, nhưng
khác hướng: ở đó bản sao bị quên, ở đây **lời chú giải trở thành luật**.
