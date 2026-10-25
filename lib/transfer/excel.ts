import ExcelJS from 'exceljs';
import { entryLimitReason, maziiEntry, type ParseResult } from '@/lib/transfer/parse';

const MAX_ROWS = 2000;

const HEADER_ALIASES: Record<string, keyof ColumnMap> = {
  word: 'word',
  từ: 'word',
  phonetic: 'phonetic',
  reading: 'phonetic',
  mean: 'mean',
  meaning: 'mean',
  nghĩa: 'mean',
  comment: 'comment',
  note: 'comment',
};

interface ColumnMap {
  word: number;
  phonetic: number;
  mean: number;
  comment: number;
}

const DEFAULT_COLUMNS: ColumnMap = { word: 1, phonetic: 2, mean: 3, comment: 4 };

function cellText(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value == null) return '';
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((r) => r.text).join('');
  }
  return String(value);
}

function resolveColumns(headerRow: ExcelJS.Row): { map: ColumnMap; isHeader: boolean } {
  const map = { ...DEFAULT_COLUMNS };
  let matched = 0;
  for (let col = 1; col <= Math.min(headerRow.cellCount, 10); col += 1) {
    const key = HEADER_ALIASES[cellText(headerRow, col).trim().toLowerCase()];
    if (key) {
      map[key] = col;
      matched += 1;
    }
  }
  return { map, isHeader: matched >= 2 };
}

export async function parseMaziiExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const result: ParseResult = { entries: [], errors: [] };
  if (!sheet || sheet.rowCount === 0) {
    result.errors.push({ line: 0, text: '', reason: 'file không có sheet/dòng nào' });
    return result;
  }

  const { map, isHeader } = resolveColumns(sheet.getRow(1));
  const firstDataRow = isHeader ? 2 : 1;
  const lastRow = Math.min(sheet.rowCount, firstDataRow + MAX_ROWS - 1);

  const seen = new Set<string>();
  for (let rowNumber = firstDataRow; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const word = cellText(row, map.word);
    const mean = cellText(row, map.mean);
    if (!word.trim() && !mean.trim()) continue; // blank row
    const entry = maziiEntry(word, cellText(row, map.phonetic), mean, cellText(row, map.comment));
    if (!entry) {
      result.errors.push({
        line: rowNumber,
        text: word || '(trống)',
        reason: 'thiếu từ hoặc thiếu nghĩa',
      });
      continue;
    }
    const tooLong = entryLimitReason(entry);
    if (tooLong) {
      result.errors.push({ line: rowNumber, text: word, reason: tooLong });
      continue;
    }
    if (seen.has(entry.expression)) continue; // duplicate row in the same file
    seen.add(entry.expression);
    result.entries.push(entry);
  }
  if (sheet.rowCount > lastRow) {
    result.errors.push({
      line: lastRow + 1,
      text: '…',
      reason: `file quá dài — chỉ đọc ${MAX_ROWS} dòng đầu, tách file để nhập phần còn lại`,
    });
  }
  return result;
}
