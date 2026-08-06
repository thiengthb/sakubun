'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Truncate } from '@/components/ui/truncate';
import { DueCell } from '@/components/shared/due-cell';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { RowActions } from '@/components/resources/row-actions';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { formatDateVN, speakable } from '@/lib/format';
import { STATE_LABELS } from '@/lib/srs-constants';

/**
 * Cột dùng chung của HAI bảng tài nguyên (ngữ pháp + từ vựng).
 *
 * Vì sao tồn tại: `items-table.tsx` và `vocab-table.tsx` là hai config trên cùng một `<DataTable>`, và
 * `dup-scan` đo được 145 cửa sổ 12-dòng trùng nhau giữa chúng — trong đó một khối 92 dòng và một khối
 * 86 dòng. Gần như toàn bộ khối đó là 7 cột FSRS/meta, ô nghĩa, ô biểu thức và ô hành động: cùng một
 * khái niệm, hiển thị cùng một cách, và **đổi cùng nhau** (câu hỏi vàng của /dedupe-scan). Sửa "Đến
 * hạn" ở một bảng mà quên bảng kia là lớp lỗi file này xoá bỏ.
 *
 * Cái KHÔNG vào đây, cố ý: bộ lọc chất lượng thẻ của ngữ pháp, badge "lý do bắt được" + cột Hán Việt
 * của từ vựng, và cột "Ví dụ" (chỉ từ vựng có). Chúng là hai domain khác nhau tình cờ ở cạnh nhau —
 * ép chung sẽ tạo abstraction sai, và abstraction sai tệ hơn duplication.
 *
 * Lưới an toàn: `e2e/resources-tables.spec.ts` lái cả hai tab qua đúng những cột này (sắp xếp "Ngày
 * thêm", bật cột ẩn "Đã ôn", lọc dùng chung) và được viết TRƯỚC lần gom này.
 */

/** Phần hình dạng mà mọi dòng tài nguyên đều có. `ItemRow` và `VocabRow` đều thoả. */
export interface ResourceRowBase {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level: string;
  suspended: boolean;
  starred: boolean;
  createdAt: string | Date;
  srs: {
    state: number;
    due: string | Date;
    reps?: number;
    lapses?: number;
    stability?: number;
    difficulty?: number;
  } | null;
}

/** TTS + furigana truyền xuống từ trang, giống nhau ở cả hai bảng. */
export interface ResourceCellPrefs {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}

/**
 * Ô biểu thức: tiếng Nhật + phát âm + furigana. `accessorFn` gộp cả cách đọc VÀ romaji của cả hai, nên
 * tìm bằng kana hoặc bằng romaji ("nagara", "takai") đều ra — và nó là accessor nên nó lái CẢ sắp xếp
 * lẫn tìm kiếm toàn cục.
 */
export function expressionColumn<T extends ResourceRowBase>(
  header: string,
  speakLabel: string,
  size: number,
  minSize: number,
  prefs: ResourceCellPrefs,
  toRomaji: (s: string) => string,
): ColumnDef<T> {
  return {
    id: 'expression',
    accessorFn: (r) =>
      `${r.expression} ${r.reading ?? ''} ${toRomaji(r.reading ?? '')} ${toRomaji(r.expression)}`,
    header,
    enableHiding: false,
    size,
    minSize,
    meta: { label: header },
    cell: ({ row }) => {
      const item = row.original;
      return (
        <SpokenLine
          text={item.expression}
          speakText={speakable(item.expression)}
          // Furigana gióng lên kanji (xử lý okurigana: 食べる → 食[た]べる); null khi chỉ có kana.
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          showFurigana={prefs.showFurigana}
          speaker={prefs.voiceSpeaker}
          rate={prefs.speechRate}
          label={speakLabel}
          truncate
        />
      );
    },
  };
}

/** Ô nghĩa (tiếng Việt), cắt một dòng. */
export function meaningColumn<T extends ResourceRowBase>(size: number): ColumnDef<T> {
  return {
    accessorKey: 'meaningVi',
    header: 'Nghĩa',
    size,
    minSize: 120,
    meta: { label: 'Nghĩa' },
    cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
  };
}

const NUM_CELL = 'text-muted-foreground tabular-nums';

/**
 * Bảy cột FSRS/meta, theo đúng thứ tự cả hai bảng đang dùng: trạng thái · đến hạn · ngày thêm, rồi bốn
 * cột phân tích ẩn mặc định (đã ôn · quên · độ bền · khó FSRS).
 *
 * `dueSize` là tham số duy nhất, vì hai bảng đang đặt 130 và 120 — giữ nguyên con số của từng bảng thay
 * vì thống nhất chúng: đổi bề rộng cột là một quyết định về giao diện, không phải hệ quả của refactor,
 * và trộn hai việc vào một commit làm cả hai khó review.
 */
export function srsMetaColumns<T extends ResourceRowBase>(dueSize: number): ColumnDef<T>[] {
  return [
    {
      id: 'state',
      accessorFn: (r) => (r.suspended ? 99 : (r.srs?.state ?? 0)),
      header: 'Trạng thái',
      size: 120,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Trạng thái' },
      cell: ({ row }) => {
        const item = row.original;
        return item.suspended ? (
          <span className="text-muted-foreground">Tạm ngưng</span>
        ) : (
          (STATE_LABELS[item.srs?.state ?? 0] ?? '—')
        );
      },
    },
    {
      id: 'due',
      accessorFn: (r) => (r.srs && r.srs.state !== 0 ? new Date(r.srs.due).getTime() : Infinity),
      header: 'Đến hạn',
      size: dueSize,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Đến hạn', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => <DueCell srs={row.original.srs} />,
    },
    {
      id: 'created',
      accessorFn: (r) => new Date(r.createdAt).getTime(),
      header: 'Ngày thêm',
      size: 120,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Ngày thêm', cellClassName: `${NUM_CELL} whitespace-nowrap` },
      cell: ({ row }) => formatDateVN(row.original.createdAt),
    },
    {
      id: 'reps',
      accessorFn: (r) => r.srs?.reps ?? 0,
      header: 'Đã ôn',
      size: 90,
      minSize: 70,
      enableGlobalFilter: false,
      meta: { label: 'Đã ôn (lần)', defaultHidden: true, cellClassName: NUM_CELL },
    },
    {
      id: 'lapses',
      accessorFn: (r) => r.srs?.lapses ?? 0,
      header: 'Quên',
      size: 90,
      minSize: 70,
      enableGlobalFilter: false,
      meta: { label: 'Quên (lần)', defaultHidden: true, cellClassName: NUM_CELL },
    },
    {
      id: 'stability',
      accessorFn: (r) => r.srs?.stability ?? 0,
      header: 'Độ bền',
      size: 110,
      minSize: 80,
      enableGlobalFilter: false,
      meta: { label: 'Độ bền (ngày)', defaultHidden: true, cellClassName: NUM_CELL },
      cell: ({ row }) => (row.original.srs ? (row.original.srs.stability?.toFixed(1) ?? '—') : '—'),
    },
    {
      id: 'difficulty',
      accessorFn: (r) => r.srs?.difficulty ?? 0,
      header: 'Khó FSRS',
      size: 110,
      minSize: 80,
      enableGlobalFilter: false,
      meta: { label: 'Độ khó FSRS', defaultHidden: true, cellClassName: NUM_CELL },
      cell: ({ row }) => (row.original.srs ? (row.original.srs.difficulty?.toFixed(1) ?? '—') : '—'),
    },
  ];
}

/**
 * Ô hành động: sao · xem kĩ (dialog chi tiết) · menu ⋮ — cùng bộ, cùng thứ tự ở cả hai bảng.
 *
 * `detailItem` là tham số vì hai bảng đưa payload khác nhau vào dialog: ngữ pháp gửi `level` +
 * `enrichment` (thẻ chi tiết của nó), từ vựng gửi `hanviet`. Đó là dữ liệu khác nhau thật, không phải
 * chi tiết cần thống nhất.
 */
export function actionsColumn<T extends ResourceRowBase>(
  kind: 'grammar' | 'vocab',
  detailItem: (row: T) => React.ComponentProps<typeof ItemDetailDialog>['item'],
  prefs: ResourceCellPrefs,
): ColumnDef<T> {
  return {
    id: 'actions',
    header: '',
    // Vừa đúng 3 nút icon size-8 (~104px nội dung) để `justify-end` xếp chúng sát nhau, không còn
    // khoảng trống — từng là 200/176 khi ở đây còn một nút chia sẻ có nhãn (2026-07-25).
    size: 120,
    minSize: 108,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    meta: { noReorder: true },
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-center justify-end gap-1">
          <StarButton id={item.itemId} starred={item.starred} kind="item" />
          <ItemDetailDialog
            item={detailItem(item)}
            kind={kind}
            triggerVariant="icon"
            voiceSpeaker={prefs.voiceSpeaker}
            speechRate={prefs.speechRate}
            showFurigana={prefs.showFurigana}
          />
          <RowActions
            item={{
              itemId: item.itemId,
              expression: item.expression,
              reading: item.reading,
              meaningVi: item.meaningVi,
              notes: item.notes,
              // `level` CHỈ cho ngữ pháp — giữ nguyên đúng khác biệt của hai bảng trước lần gom này, và
              // nó là khác biệt CÓ LÝ: `ItemEditForm` chỉ gửi `level` khi `kind === 'grammar'` và ẩn ô
              // chọn cấp cho từ vựng ("vocab is not level-gated"). Đã kiểm trước khi gom, vì thoạt nhìn
              // nó giống một chỗ bỏ sót đáng "sửa luôn" — sửa thì sẽ là đổi hành vi lén trong một
              // commit refactor, mà ở đây còn là đổi sai.
              ...(kind === 'grammar' ? { level: item.level } : {}),
              suspended: item.suspended,
            }}
            kind={kind}
          />
        </div>
      );
    },
  };
}
