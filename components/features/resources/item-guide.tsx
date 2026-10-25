import { FormGuide, GuideSample, type GuideItem } from '@/components/common/form-guide';
import { ITEM_LIMITS } from '@/lib/library/item-limits';
import type { ItemKind } from '@/components/features/resources/item-fields';

// The guides under the add and edit cards, one per way in. Each claim is what the code does:
// limits from ITEM_LIMITS, line formats from lib/transfer/parse.ts, columns from lib/transfer/excel.ts.

const LEVEL_TEXT =
  'Không rõ thì để trống, mục được xếp N5. Cấp dùng để lọc kho và chọn mục khi luyện.';

export function ItemGuide({ kind, editing = false }: { kind: ItemKind; editing?: boolean }) {
  const items: GuideItem[] = [
    kind === 'grammar'
      ? {
          term: 'Mẫu ngữ pháp',
          text: `Viết như trong sách, giữ dấu 〜 ở chỗ nối. Tối đa ${ITEM_LIMITS.expression} ký tự.`,
        }
      : {
          term: 'Từ (tiếng Nhật)',
          text: `Viết bằng kanji nếu từ có kanji. Tối đa ${ITEM_LIMITS.expression} ký tự.`,
        },
    {
      term: 'Cách đọc (kana)',
      text: `Chỉ cần khi có kanji, viết bằng hiragana hoặc katakana. Tối đa ${ITEM_LIMITS.reading} ký tự.`,
    },
    {
      term: 'Nghĩa (tiếng Việt)',
      text: `Một nghĩa ngắn, tối đa ${ITEM_LIMITS.meaningVi} ký tự. Phần giải thích dài để ở thẻ chi tiết.`,
    },
    { term: 'Cấp JLPT', text: LEVEL_TEXT },
    {
      term: 'Ghi chú',
      text:
        kind === 'grammar'
          ? 'Cấu trúc, cách chia, sắc thái: những gì giúp bạn nhớ khi gặp lại.'
          : 'Câu ví dụ, sắc thái, cách dùng: những gì giúp bạn nhớ khi gặp lại.',
    },
    editing
      ? {
          term: 'Lịch ôn',
          text: 'Sửa nội dung không đổi lịch ôn: ngày ôn tới và độ nhớ của mục giữ nguyên.',
        }
      : {
          term: 'Thêm nhiều mục',
          text: 'Dùng tab Dán danh sách hoặc Nhập Excel để thêm cả loạt một lần.',
        },
  ];
  return <FormGuide items={items} />;
}

const BULK_SHARED: GuideItem[] = [
  {
    term: 'Dòng lỗi',
    text: 'Dòng thiếu từ hoặc nghĩa, hay vượt giới hạn độ dài, hiện màu đỏ và bị bỏ qua. Các dòng còn lại vẫn được thêm.',
  },
  { term: 'Mục đã có', text: 'Mục trùng với kho được bỏ qua, không ghi đè mục cũ.' },
];

export function PasteGuide({ kind }: { kind: ItemKind }) {
  const sample =
    kind === 'grammar'
      ? '〜ばかりに: chỉ vì… (hậu quả xấu) N2'
      : '図書館 (としょかん): thư viện N5';
  return (
    <FormGuide
      items={[
        {
          term: 'Mỗi dòng một mục',
          text: (
            <>
              Viết <GuideSample>{sample}</GuideSample>: mục, cách đọc trong ngoặc nếu có, dấu hai
              chấm, rồi nghĩa.
            </>
          ),
        },
        {
          term: 'Chép từ Excel',
          text: 'Bôi đen các hàng trong file Mazii rồi dán thẳng vào: các cột từ, cách đọc, nghĩa, ghi chú được nhận ra.',
        },
        {
          term: 'Cấp JLPT',
          text: 'Ghi N1 đến N5 trong dòng. Dòng không ghi cấp lấy Cấp JLPT mặc định.',
        },
        ...BULK_SHARED,
        {
          term: 'Danh sách lộn xộn?',
          text: (
            <>
              Nhờ Claude Desktop hoặc ChatGPT dọn hộ bằng prompt{' '}
              <GuideSample>import_grammar</GuideSample>, rồi dán kết quả vào đây.
            </>
          ),
        },
      ]}
    />
  );
}

export function ExcelGuide() {
  return (
    <FormGuide
      items={[
        {
          term: 'File nào',
          text: 'File .xlsx tải từ sổ tay Mazii; app đọc 2000 dòng đầu. Hàng đầu ghi tên cột word, phonetic, mean, comment; không có hàng đó thì đọc theo thứ tự từ, cách đọc, nghĩa, ghi chú.',
        },
        {
          term: 'Xem trước',
          text: 'Chọn file chỉ đọc để xem trước. Chưa có gì vào kho cho tới khi bạn bấm Thêm.',
        },
        {
          term: 'Nghĩa dài',
          text: `Nghĩa nhiều ý được giữ vài ý đầu cho vừa ${ITEM_LIMITS.meaningVi} ký tự.`,
        },
        {
          term: 'Cấp JLPT',
          text: 'Ghi N1 đến N5 trong cột comment. Dòng không ghi cấp lấy Cấp JLPT mặc định.',
        },
        ...BULK_SHARED,
      ]}
    />
  );
}
