export interface CatalogEntry {
  name: string;
  kind: 'tool' | 'prompt';
  summary: string; // vi — one line describing the tool to a human reader
}

export const MCP_CATALOG: CatalogEntry[] = [
  { name: 'next_turn', kind: 'tool', summary: 'Lấy mục tiếp theo và cách soạn câu cho nó' },
  {
    name: 'stage_turn',
    kind: 'tool',
    summary: 'Lưu câu đề trước khi bạn trả lời; server kiểm câu',
  },
  { name: 'grade_turn', kind: 'tool', summary: 'Chấm một lần, điểm 1-4, ghi lịch FSRS' },
  { name: 'skip_turn', kind: 'tool', summary: 'Bỏ qua lượt, không tính vào lịch' },
  {
    name: 'lookup',
    kind: 'tool',
    summary: 'Tìm mẫu hoặc từ trong kho của bạn; không có thì báo Kho chung có không',
  },
  { name: 'add_items', kind: 'tool', summary: 'Thêm mẫu hoặc từ khi bạn đồng ý' },
  {
    name: 'example_add',
    kind: 'tool',
    summary: 'Thêm câu ví dụ có dịch vào thẻ của một mục khi bạn đồng ý; server kiểm câu',
  },
  { name: 'status', kind: 'tool', summary: 'Đến hạn bao nhiêu, hôm nay còn lại bao nhiêu' },
  { name: 'kaiwa_list', kind: 'tool', summary: 'Liệt kê kịch bản Kaiwa của bạn' },
  { name: 'kaiwa_get', kind: 'tool', summary: 'Đọc một kịch bản Kaiwa trước khi sửa' },
  {
    name: 'kaiwa_save',
    kind: 'tool',
    summary: 'Lưu kịch bản Kaiwa khi bạn đồng ý; server kiểm định dạng',
  },
  {
    name: 'library_search',
    kind: 'tool',
    summary: 'Tìm mẫu, từ hoặc nhóm có sẵn trên Kho chung',
  },
  {
    name: 'library_take',
    kind: 'tool',
    summary: 'Lấy một mục hoặc cả nhóm từ Kho chung về kho của bạn khi bạn đồng ý',
  },
  { name: 'hoc', kind: 'prompt', summary: 'Học theo lịch ôn, dịch từng câu với Claude' },
  { name: 'kaiwa', kind: 'prompt', summary: 'Soạn kịch bản hội thoại cùng AI rồi lưu vào Sakubun' },
  // Profile `planner` only: a calendar bot reads load counts, nothing else.
  { name: 'ping', kind: 'tool', summary: 'Kiểm tra kết nối MCP còn sống (profile planner)' },
  {
    name: 'get_review_load',
    kind: 'tool',
    summary: 'Số mục đến hạn trong vài ngày tới, cho bot xếp lịch (profile planner, chỉ đọc)',
  },
];
