// Single source of truth for the MCP surface — drives the /guide MCP tab.
// Adding/removing a tool or prompt in server.ts MUST update this list in the same change.

export interface CatalogEntry {
  name: string;
  kind: 'tool' | 'prompt';
  summary: string; // vi — shown in the guide table
}

export const MCP_CATALOG: CatalogEntry[] = [
  { name: 'ping', kind: 'tool', summary: 'Kiểm tra kết nối MCP còn sống' },
  {
    name: 'get_protocol',
    kind: 'tool',
    summary:
      'Nạp hướng dẫn của kiểu luyện khác khi bạn đổi dịch ↔ quiz ↔ hội thoại giữa buổi (Claude tự gọi, không hiện ra)',
  },
  {
    name: 'check_library',
    kind: 'tool',
    summary:
      'Tra một mẫu/từ trong kho của bạn trong MỘT lần gọi — trả về trạng thái ôn, chất lượng thẻ, kèm đề xuất việc cần làm (thêm/soạn thẻ/bật lại/mở rộng cấp). Claude tự gọi trước khi giảng bất cứ mẫu nào',
  },
  { name: 'get_settings', kind: 'tool', summary: 'Đọc toàn bộ cài đặt luyện tập hiện tại' },
  {
    name: 'update_settings',
    kind: 'tool',
    summary:
      'Sửa một phần cài đặt (level, hướng dịch, cỡ câu, độ khó, văn phong, nhịp học, giờ nhắc…)',
  },
  {
    name: 'preview_import',
    kind: 'tool',
    summary:
      'Dán tài liệu Nhật thật (email, trang truyện, đề thi thử, ảnh chụp) — Claude bóc ra các mẫu/từ đáng học rồi ĐỐI CHIẾU với kho: cái nào đã có, cái nào cần bạn quyết, cái nào thêm được. Chỉ xem trước, KHÔNG ghi gì',
  },
  {
    name: 'add_grammar',
    kind: 'tool',
    summary:
      'Thêm mẫu ngữ pháp hàng loạt (đơn vị luyện duy nhất; kèm reading/furigana khi có kanji)',
  },
  {
    name: 'add_vocab',
    kind: 'tool',
    summary:
      'Thêm từ vựng người dùng vừa tra HOẶC Claude chủ động gắn cờ (reason: dùng sai / chưa hiểu / chưa dùng) vào kho ôn của sakubun — kèm cách đọc + ÂM HÁN VIỆT (sinoVietnamese); dệt lại vào câu dịch sau này (học từ trong ngữ cảnh, ngân sách tách khỏi ngữ pháp)',
  },
  {
    name: 'get_due_items',
    kind: 'tool',
    summary:
      'Lấy lô mẫu ngữ pháp cần luyện cho MỘT câu tiếp theo (server chọn theo FSRS + cài đặt; hỗ trợ trọng tâm theo cấp/mẫu hoặc điểm yếu, thiếu thì tự bù mẫu khác) — kèm "hồ sơ người học" rút ra từ chính lịch sử của bạn để câu được nhắm đúng chỗ hay sai',
  },
  {
    name: 'stage_sentence',
    kind: 'tool',
    summary:
      'Ghi TRƯỚC câu đề + bản dịch mẫu + danh sách mẫu trong lô + furigana (dạng 漢字[かな] cho câu đề JA và cho đáp án JA) trước khi hiện đề → trả sentenceId; đảm bảo đáp án tham khảo không bị ảnh hưởng bởi bài làm. Nhận thêm extraPatterns — ngữ pháp Claude cố ý dùng NGOÀI lô: server đối chiếu với kho của bạn và báo mẫu nào bạn chưa từng gặp (để được giảng + mời thêm vào kho) hoặc nào vượt cấp đang luyện. Với câu QUIZ, nhận thêm quiz { correct, distractors } — server tự xếp 4 phương án vào A–D (Claude không được chọn vị trí đáp án) và từ chối bộ phương án bị trùng',
  },
  {
    name: 'submit_review',
    kind: 'tool',
    summary:
      'Ghi kết quả sau khi chấm: sentenceId (từ stage_sentence), bài dịch, rating 1–4 từng mẫu, assists (số lần bạn được gợi ý) → cập nhật lịch FSRS. Server hạ "4 Easy" xuống Good nếu bạn trả lời lâu hoặc cần gợi ý, và báo cho bạn biết đã hạ',
  },
  {
    name: 'skip_sentence',
    kind: 'tool',
    summary:
      'Bỏ qua câu đang chờ (khi người dùng nói "bỏ qua"/"skip") — câu vẫn lưu vào lịch sử kèm đáp án tham khảo nhưng KHÔNG tính vào FSRS',
  },
  {
    name: 'get_stats',
    kind: 'tool',
    summary:
      'Tổng quan tiến độ: đến hạn, đã học hôm nay, dự báo 7 ngày, item hay sai — kèm ghi nhớ thực tế so với mục tiêu, TỐI ĐA MỘT gợi ý dọn kho lúc mở buổi, và bản tóm tắt "hồ sơ người học" (chỉ Claude đọc) để buổi học nhắm đúng điểm yếu thật',
  },
  {
    name: 'get_weak_report',
    kind: 'tool',
    summary: 'Báo cáo điểm yếu 30 ngày: lỗi theo loại, mục sai nhiều nhất, danh sách leech',
  },
  {
    name: 'enrich_items',
    kind: 'tool',
    summary:
      'Lưu / CẬP NHẬT thẻ enrichment (cách dùng, cụm đi kèm, ví dụ, bẫy, phân biệt) — cho backlog HOẶC khi bạn nói "sửa/bổ sung enrichment của mẫu này"; ghi đè toàn thẻ (Claude đọc thẻ cũ trước rồi gửi lại bản đầy đủ)',
  },
  {
    name: 'get_library_health',
    kind: 'tool',
    summary:
      'Khám sức khoẻ CẢ KHO: số thẻ đạt/chưa đạt, thẻ theo format cũ, lỗ hổng ở cấp đang học, số mẫu dưới cấp còn trong hàng đợi, ghi nhớ thực tế so với mục tiêu, từ thiếu Hán Việt — kèm tối đa 2 đề xuất dọn dẹp',
  },
  {
    name: 'patch_enrichment',
    kind: 'tool',
    summary:
      'BỔ SUNG vào thẻ enrichment mà KHÔNG ghi đè phần còn lại (thêm phân biệt / bẫy / ví dụ / cấu trúc, sửa cách dùng) — trùng và quá giới hạn thì báo lại; lấy được phần thiếu từ một thẻ công khai đầy hơn',
  },
  {
    name: 'list_grammar',
    kind: 'tool',
    summary:
      'Tìm/lọc kho NGỮ PHÁP — lọc được theo CHẤT LƯỢNG thẻ (chưa có / lỗi / còn thiếu / format cũ / đủ), không chỉ có-thẻ-hay-không',
  },
  {
    name: 'list_vocab',
    kind: 'tool',
    summary:
      'Tìm/lọc kho TỪ VỰNG (tra từ đã có, liệt kê từ tạm ngưng, trước khi bổ sung Hán Việt/nghĩa)',
  },
  {
    name: 'update_grammar',
    kind: 'tool',
    summary:
      'Sửa NỘI DUNG một mẫu ngữ pháp (mẫu/đọc/nghĩa/notes/level) — không đụng lịch FSRS; enrichment sửa qua enrich_items',
  },
  {
    name: 'update_vocab',
    kind: 'tool',
    summary:
      'Sửa NỘI DUNG một từ vựng (từ/đọc/âm Hán Việt/nghĩa/notes/level) — không đụng lịch FSRS',
  },
  { name: 'set_item_suspended', kind: 'tool', summary: 'Tạm ngưng / học lại một item' },
  {
    name: 'get_quiz_items',
    kind: 'tool',
    summary:
      'Lấy MỘT mẫu ngữ pháp đến hạn làm mẫu ĐÚNG cho một câu quiz trắc nghiệm A–D — kèm enrichment + hai danh sách phương án nhiễu ỨNG VIÊN lấy từ chính kho của bạn (contrastCandidates = mẫu dễ nhầm thật, gồm cả liên kết ngược từ thẻ khác; sameLevelCandidates = cùng cấp, yếu hơn) để Claude CHỌN thay vì tự nghĩ ra. Vị trí đáp án do server xếp ở bước stage_sentence, không phải Claude tự chọn',
  },
  {
    name: 'set_below_target_suspended',
    kind: 'tool',
    summary:
      'Ẩn / hiện lại toàn bộ ngữ pháp ở cấp dưới trình độ đang học (học nhanh tới đúng trình độ; đảo ngược được)',
  },
  {
    name: 'list_calibration_proposals',
    kind: 'tool',
    summary:
      'Xem những lần app ĐỊNH chỉnh độ khó / cỡ câu / mức trợ giúp cho bạn nhưng chưa chỉnh — kèm lý do, mới nhất trước. App chạy ở chế độ đề xuất: nó không tự đổi gì cả',
  },
  {
    name: 'set_proposal_verdict',
    kind: 'tool',
    summary:
      'Ghi lại câu trả lời của bạn cho một đề xuất ở trên: app đọc đúng trình độ bạn (agree) hay không (disagree)',
  },
  {
    name: 'list_groups',
    kind: 'tool',
    summary:
      'Liệt kê các NHÓM học (tên, loại vocab/grammar/mixed, số thành viên) — lấy groupId để luyện nhóm hoặc thêm/gỡ item',
  },
  {
    name: 'create_group',
    kind: 'tool',
    summary:
      'Tạo một nhóm rỗng (tên + loại vocab/grammar/mixed) — chỉ gọi SAU khi bạn đã đề xuất và người dùng đồng ý; rồi dùng add_items_to_group để thêm thành viên',
  },
  {
    name: 'add_items_to_group',
    kind: 'tool',
    summary:
      'Thêm item (ngữ pháp/từ vựng) vào một nhóm — idempotent, kiểm loại nhóm (grammar chỉ nhận ngữ pháp…); trả về số thành viên mới',
  },
  {
    name: 'remove_items_from_group',
    kind: 'tool',
    summary: 'Gỡ item khỏi một nhóm (item + lịch sử FSRS giữ nguyên, chỉ bỏ tư cách thành viên)',
  },
  {
    name: 'suggest_group',
    kind: 'tool',
    summary:
      'CHẠY THỬ một đề xuất nhóm (KHÔNG ghi gì) — Claude tự chọn item + tên, tool kiểm và trả về item hợp lệ / bị loại theo loại / không tìm thấy để bạn duyệt trước khi tạo thật',
  },
  {
    name: 'practice',
    kind: 'prompt',
    summary:
      'Bắt đầu buổi luyện DỊCH: hỏi trọng tâm rồi vào vòng lặp gia sư đầy đủ. Câu Việt → Nhật có 3 mức trợ giúp — nói "cho tôi điền mẫu" (điền đúng chỗ của mẫu vào câu Nhật đã viết sẵn) hoặc "cho gợi ý từ" (tự dịch cả câu nhưng được cho sẵn mẫu + từ khoá) thay vì tự dịch trắng; nói "quiz" để chuyển sang trắc nghiệm A–D',
  },
  {
    name: 'story_practice',
    kind: 'prompt',
    summary: 'Luyện theo hội thoại/truyện ngắn: dệt 6–8 mục vào một đoạn, dịch từng câu',
  },
  {
    name: 'quiz',
    kind: 'prompt',
    summary:
      'Luyện QUIZ trắc nghiệm: mỗi câu 1 mẫu ngữ pháp + 1 chỗ trống (＿＿) + 4 đáp án A–D (mẫu đúng + 3 mẫu dễ nhầm) — CHỌN một chữ cái, Claude chấm 1–4',
  },
  {
    name: 'conversation',
    kind: 'prompt',
    summary:
      'Luyện HỘI THOẠI theo tình huống: Claude dựng bối cảnh (bạn là ai, nói với ai, ở đâu) + văn phong + mẫu/từ cần dùng, BẠN tự nói câu tiếng Nhật hợp cảnh — chấm cả độ hợp văn phong lẫn cách dùng mẫu (1–4)',
  },
  {
    name: 'teach_back',
    kind: 'prompt',
    summary:
      'Luyện GIẢNG LẠI: Claude đưa một mẫu, BẠN giảng lại bằng tiếng Việt (nghĩa, cách gắn, khi nào dùng, ví dụ của bạn) — chấm phần giải thích và chỉ chỗ còn thiếu; giảng hay thì lưu chính lời bạn vào thẻ của mẫu',
  },
  {
    name: 'import_grammar',
    kind: 'prompt',
    summary: 'Nhập danh sách mẫu ngữ pháp (dán từ Mazii/nguồn bất kỳ)',
  },
  {
    name: 'enrich_backlog',
    kind: 'prompt',
    summary:
      'Soạn thẻ enrichment cho mẫu ngữ pháp VÀ từ vựng còn thiếu (duyệt trước 3 thẻ mẫu rồi chạy theo lô)',
  },
];
