// OpenJLPT tells apart patterns that are written the same with an English label in brackets:
// 〜が（subject）, 〜に（place of existence）. On Kho chung the pattern stands alone and the label
// becomes a small note in Vietnamese (thien, 7.4 Kho chung). Pure. A label in Japanese (〜場合（は）)
// is part of the pattern and stays; an English label not in the list stays as it is.

const LABEL_VI: Record<string, string> = {
  subject: 'chủ ngữ',
  time: 'thời điểm',
  destination: 'nơi đến',
  'place of existence': 'nơi tồn tại',
  'indirect object': 'tân ngữ gián tiếp',
  frequency: 'tần suất',
  'place of action': 'nơi diễn ra hành động',
  means: 'phương tiện, cách thức',
  and: 'liệt kê đủ',
  with: 'cùng với',
  or: 'lựa chọn',
  possessive: 'sở hữu',
  from: 'điểm bắt đầu',
  until: 'điểm kết thúc',
  question: 'câu hỏi',
  while: 'đồng thời',
  reason: 'lý do',
  but: 'đối lập',
  decide: 'quyết định',
  approximately: 'khoảng chừng',
  'na-adjective': 'tính từ đuôi な',
  named: 'tên gọi',
  appearance: 'vẻ bề ngoài',
  hearsay: 'nghe nói',
  'hearsay/conjecture': 'nghe nói, phỏng đoán',
  potential: 'khả năng',
  passive: 'bị động',
  prohibition: 'cấm đoán',
  conditional: 'điều kiện',
  although: 'nhượng bộ',
  purpose: 'mục đích',
  'embedded question': 'câu hỏi lồng',
  emphasis: 'nhấn mạnh',
  nominalizer: 'danh từ hoá',
  suggestion: 'rủ rê, đề nghị',
  make: 'làm cho',
  instruction: 'quy định, chỉ thị',
  'typical of': 'đúng chất',
  like: 'so sánh, ví dụ',
  extent: 'mức độ',
  even: 'đến cả',
};

const LABELLED = /^(.+?)\s*[（(]([A-Za-z][A-Za-z /-]*)[）)]\s*$/;

/** The pattern without its English label, and the label in Vietnamese (or as written). */
export function splitPatternLabel(expression: string): { pattern: string; label: string | null } {
  const m = expression.match(LABELLED);
  if (!m) return { pattern: expression, label: null };
  return { pattern: m[1], label: LABEL_VI[m[2].toLowerCase()] ?? m[2] };
}
