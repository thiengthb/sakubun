import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseMaziiExcel } from '@/lib/excel-import';

async function workbookBuffer(rows: (string | undefined)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('parseMaziiExcel', () => {
  it('parses a Mazii export with header row', async () => {
    const buffer = await workbookBuffer([
      ['word', 'phonetic', 'mean', 'comment'],
      ['人', 'と ひと にん', 'con người; nhân loại; người; người khác; người ta', ''],
      ['勉強', 'べんきょう', 'học; việc học', 'chăm chỉ N5'],
    ]);
    const result = await parseMaziiExcel(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      expression: '人',
      reading: 'と ひと にん',
      meaningVi: 'con người; nhân loại; người; người khác…',
    });
    expect(result.entries[1]).toMatchObject({ expression: '勉強', level: 'N5' });
  });

  it('handles a headerless file positionally and dedupes rows', async () => {
    const buffer = await workbookBuffer([
      ['人', 'ひと', 'người', ''],
      ['人', 'ひと', 'người', ''],
      ['', '', '', ''],
    ]);
    const result = await parseMaziiExcel(buffer);
    expect(result.entries).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('reports rows missing word or meaning', async () => {
    const buffer = await workbookBuffer([
      ['word', 'phonetic', 'mean', 'comment'],
      ['人', 'ひと', '', ''],
    ]);
    const result = await parseMaziiExcel(buffer);
    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});
