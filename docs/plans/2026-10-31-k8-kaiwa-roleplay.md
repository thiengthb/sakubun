# Kế hoạch K8: nhập vai với AI từ một kịch bản

- Ngày: 2026-10-31. Duyệt: thien, 2026-10-31 03:48 ("theo đề xuất"): không lưu buổi nhập vai, mặc định theo kịch
  bản (nói "tự do" thì AI ứng biến trong cùng cảnh), có nút chép câu nhờ trên web.
- Gốc: hàng K8 trong `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md` ("MCP nhập vai theo kịch bản (AI đóng một
  vai, người học đóng vai kia)", rủi ro high). Bản thảo cho thien: https://claude.ai/artifact/3NNxDPxZQR2FxtJEVHCzJH

## Người học dùng thế nào

1. Trên trang kịch bản chọn "Tôi là A", bấm "Nhập vai với AI": app chép sẵn một câu nhờ (ví dụ "Nhập vai kịch bản
   Phỏng vấn trong Sakubun, tôi là A.") để dán vào claude.ai. Tự gõ câu đó cũng được.
2. AI gọi `kaiwa_roleplay` với kịch bản và vai. Server trả từng lượt (của AI, của người học, kèm câu mẫu và nghĩa)
   và luật chơi.
3. AI nói câu đầu của vai nó rồi dừng, không nói hộ câu của người học.
4. Người học trả lời bằng tiếng Nhật (gõ, hoặc chế độ giọng nói của app Claude). AI so với câu mẫu: đúng ý thì đi
   tiếp, sai thì sửa ngắn bằng tiếng Việt. "gợi ý": vài chữ đầu câu mẫu. "tự do": AI ứng biến trong cùng cảnh.
5. Hết bài AI tóm tắt câu nói tốt, câu nên luyện lại, và đưa đường dẫn về trang kịch bản.

## Quyết định

| Câu hỏi               | Chọn                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| Lưu buổi nhập vai?    | Không. AI chỉ sửa trong chat. Lưu vào Lịch sử cần đổi schema, làm sau nếu cần   |
| Bám kịch bản tới đâu? | Theo kịch bản; người học nói "tự do" thì AI ứng biến trong cùng cảnh            |
| Lối vào từ web        | Nút "Nhập vai với AI" trên trang kịch bản, chỉ chép câu nhờ, không mở claude.ai |

## Server ép gì

- `scriptId` sai: lỗi ngắn, bảo gọi `kaiwa_list`. Chỉ đọc kịch bản của chính người học (`learnerDb`).
- Vai không có trong kịch bản: lỗi kèm danh sách vai đúng (so không phân biệt hoa thường).
- Kịch bản không có vai (độc thoại): lỗi, gợi ý luyện bằng "Nghe cả bài" và "Che câu của tôi" trên web.
- Kết quả gọn, một dòng mỗi lượt, bỏ cách đọc `[..]`; nằm trong ngân sách token của `token-budget.test.ts`.

## Các PR

| PR  | Nội dung                                                                                                   | Kiểm                                                                             | Rủi ro     |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| K8a | Hàm thuần `lib/kaiwa/roleplay.ts`, tool MCP `kaiwa_roleplay`, một dòng trong prompt `kaiwa`, danh mục tool | Test hàm thuần, test MCP client, ngân sách token; thien thử thật trong claude.ai | high (MCP) |
| K8b | Nút "Nhập vai với AI" trên `/kaiwa/[id]`, dòng Hội thoại trong Cài đặt > Hướng dẫn                         | e2e, ảnh trước/sau 1440 và 390 cho thien duyệt                                   | medium     |

Xong K8 khi thien đã nhập vai thật một kịch bản trong claude.ai và thấy ổn.
