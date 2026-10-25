'use client';

import { type ReactNode, useMemo, useRef, useState, useTransition } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { addOneItemAction, importItemsAction, parseExcelAction } from '@/app/actions';
import { parseImportText, type ParsedEntry, type ParseResult } from '@/lib/transfer/parse';
import { JLPT_LEVELS, type JlptLevel } from '@/lib/settings/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormActions } from '@/components/common/field';
import { ITEM_LIMITS, itemTextError } from '@/lib/library/item-limits';
import { textLength } from '@/lib/library/group-limits';
import { Input } from '@/components/ui/input';

export type ResourceKind = 'grammar' | 'vocab';

const COPY: Record<
  ResourceKind,
  {
    trigger: string;
    title: string;
    description: string;
    noun: string; // singular unit for counts/buttons ("mẫu" / "từ")
    exprLabel: string;
    exprPlaceholder: string;
    readingPlaceholder: string;
    meaningPlaceholder: string;
    pastePlaceholder: string;
  }
> = {
  grammar: {
    trigger: 'Thêm ngữ pháp',
    title: 'Thêm ngữ pháp',
    description:
      'Thêm một mẫu, dán cả danh sách, hoặc tải file Excel từ Mazii. Đây là kho ngữ pháp — chạy trên lịch ôn riêng.',
    noun: 'mẫu',
    exprLabel: 'Mẫu ngữ pháp',
    exprPlaceholder: '〜ばかりに',
    readingPlaceholder: '',
    meaningPlaceholder: 'chỉ vì… (dẫn đến hậu quả xấu)',
    pastePlaceholder:
      'Dán thẳng các dòng copy từ Excel Mazii (word ⇥ phonetic ⇥ mean ⇥ comment), hoặc mỗi dòng một mục:\n〜ばかりに: chỉ vì… (hậu quả xấu) N2\n〜わけにはいかない: không thể… (vì lý do tâm lý) N3',
  },
  vocab: {
    trigger: 'Thêm từ vựng',
    title: 'Thêm từ vựng',
    description:
      'Thêm một từ, dán cả danh sách, hoặc tải file Excel từ Mazii. Từ chạy trên lịch ôn riêng, không lấn ngữ pháp.',
    noun: 'từ',
    exprLabel: 'Từ (tiếng Nhật)',
    exprPlaceholder: '図書館',
    readingPlaceholder: 'としょかん',
    meaningPlaceholder: 'thư viện',
    pastePlaceholder:
      'Dán thẳng các dòng copy từ Excel Mazii (word ⇥ phonetic ⇥ mean ⇥ comment), hoặc mỗi dòng một mục:\n図書館 (としょかん): thư viện N5\n勉強 (べんきょう): học N5',
  },
};

export function ResourceAddPanels({ kind, onDone }: { kind: ResourceKind; onDone: () => void }) {
  const copy = COPY[kind];
  return (
    <>
      <TabsContent value="single">
        <SingleTab kind={kind} copy={copy} onDone={onDone} />
      </TabsContent>
      <TabsContent value="paste">
        <PasteTab kind={kind} copy={copy} onDone={onDone} />
      </TabsContent>
      <TabsContent value="excel">
        <ExcelTab kind={kind} copy={copy} onDone={onDone} />
      </TabsContent>
    </>
  );
}

type TabCopy = (typeof COPY)[ResourceKind];

function SingleTab({
  kind,
  copy,
  onDone,
}: {
  kind: ResourceKind;
  copy: TabCopy;
  onDone: () => void;
}) {
  const [expression, setExpression] = useState('');
  const [reading, setReading] = useState('');
  const [meaningVi, setMeaningVi] = useState('');
  const [level, setLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  // Too long shows at once, while typing; empty only once the form is sent.
  const [sent, setSent] = useState(false);
  const errors = {
    expression:
      itemTextError('expression', expression) ??
      (sent && !expression.trim() ? `Cần nhập ${copy.exprLabel.toLowerCase()}` : null),
    reading: itemTextError('reading', reading),
    meaningVi:
      itemTextError('meaningVi', meaningVi) ??
      (sent && !meaningVi.trim() ? 'Cần nhập nghĩa' : null),
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSent(true);
    const bad =
      !expression.trim() || errors.expression
        ? '#add-expression'
        : errors.reading
          ? '#add-reading'
          : !meaningVi.trim() || errors.meaningVi
            ? '#add-meaning'
            : null;
    if (bad) {
      e.currentTarget.querySelector<HTMLElement>(bad)?.focus();
      return;
    }
    startTransition(async () => {
      const r = await addOneItemAction(
        {
          expression,
          reading: reading.trim() || undefined,
          meaningVi,
          level: level || undefined,
          notes: notes.trim() || undefined,
        },
        kind,
      );
      if (toastResult(r, `Đã thêm ${copy.noun} vào kho`)) {
        setExpression('');
        setReading('');
        setMeaningVi('');
        setLevel('');
        setNotes('');
        setSent(false);
        onDone();
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="@container space-y-4">
      <div className="grid gap-4 @2xl:grid-cols-2">
        <Field
          label={copy.exprLabel}
          required
          error={errors.expression}
          count={{ value: textLength(expression.trim()), max: ITEM_LIMITS.expression }}
        >
          <Input
            id="add-expression"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            lang="ja"
            placeholder={copy.exprPlaceholder}
            autoFocus
          />
        </Field>
        <Field
          label="Cách đọc (kana)"
          error={errors.reading}
          count={{ value: textLength(reading.trim()), max: ITEM_LIMITS.reading }}
        >
          <Input
            id="add-reading"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            lang="ja"
            placeholder={copy.readingPlaceholder}
          />
        </Field>
        <Field
          label="Nghĩa (tiếng Việt)"
          required
          error={errors.meaningVi}
          count={{ value: textLength(meaningVi.trim()), max: ITEM_LIMITS.meaningVi }}
          className="@2xl:col-span-2"
        >
          <Input
            id="add-meaning"
            value={meaningVi}
            onChange={(e) => setMeaningVi(e.target.value)}
            placeholder={copy.meaningPlaceholder}
          />
        </Field>
        <Field label="Cấp độ">
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Không rõ" />
            </SelectTrigger>
            <SelectContent>
              {JLPT_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ghi chú" className="@2xl:col-span-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Sắc thái, cách dùng, ví dụ ngắn…"
          />
        </Field>
      </div>
      <FormActions>
        <Button type="button" variant="outline" disabled={isPending} onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Đang thêm…' : `Thêm ${copy.noun}`}
        </Button>
      </FormActions>
    </form>
  );
}

const EMPTY_PARSE: ParseResult = { entries: [], errors: [] };

function BulkPanel({
  kind,
  copy,
  parse,
  onDone,
  children,
}: {
  kind: ResourceKind;
  copy: TabCopy;
  parse: ParseResult;
  onDone: () => void;
  /** The input control (textarea / file picker), given the error to show under it. */
  children: (error: string | null) => ReactNode;
}) {
  const [defaultLevel, setDefaultLevel] = useState<JlptLevel>('N5');
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const entries: ParsedEntry[] = parse.entries.map((e) => ({
    ...e,
    level: e.level ?? defaultLevel,
  }));
  const hasResult = parse.entries.length > 0 || parse.errors.length > 0;

  const error = sent && entries.length === 0 ? `Chưa có ${copy.noun} hợp lệ nào để thêm` : null;

  const submit = () => {
    setSent(true);
    if (entries.length === 0) return;
    startTransition(async () => {
      const r = await importItemsAction(entries, kind);
      const ok = toastResult(
        r,
        ({ created, skipped }) =>
          `Đã thêm ${created} ${copy.noun}${skipped.length > 0 ? `, bỏ qua ${skipped.length} trùng/lỗi` : ''}`,
      );
      if (ok) onDone();
    });
  };

  return (
    <div className="space-y-4">
      {children(error)}

      {hasResult && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">
              {entries.length} {copy.noun} hợp lệ
            </Badge>
            {parse.errors.length > 0 && (
              <Badge variant="outline" className="text-alert">
                {parse.errors.length} dòng lỗi
              </Badge>
            )}
            <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-start">
              <label htmlFor="bulk-default-level" className="text-sm font-bold">
                Cấp độ mặc định
              </label>
              <Select value={defaultLevel} onValueChange={(v) => setDefaultLevel(v as JlptLevel)}>
                <SelectTrigger id="bulk-default-level" className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JLPT_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-md border">
              <ul className="divide-y sm:hidden">
                {entries.map((e, i) => (
                  <li key={`${e.expression}-${i}`} className="space-y-1 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span lang="ja" className="min-w-0 truncate font-medium">
                        {e.expression}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {e.level}
                      </Badge>
                    </div>
                    {e.reading && (
                      <p lang="ja" className="truncate text-xs text-muted-foreground">
                        {e.reading}
                      </p>
                    )}
                    <p className="text-xs">{e.meaningVi}</p>
                  </li>
                ))}
              </ul>
              <Table className="max-sm:hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.exprLabel}</TableHead>
                    <TableHead>Cách đọc</TableHead>
                    <TableHead>Nghĩa</TableHead>
                    <TableHead>Cấp độ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e, i) => (
                    <TableRow key={`${e.expression}-${i}`}>
                      <TableCell lang="ja" className="max-w-40 truncate font-medium">
                        {e.expression}
                      </TableCell>
                      <TableCell lang="ja" className="max-w-32 truncate text-muted-foreground">
                        {e.reading ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-72 truncate">{e.meaningVi}</TableCell>
                      <TableCell>{e.level}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {parse.errors.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-auto text-xs text-alert">
              {parse.errors.map((err) => (
                <li key={`${err.line}-${err.reason}`}>
                  Dòng {err.line}: “{err.text}” — {err.reason}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <FormActions>
        <Button type="button" variant="outline" disabled={isPending} onClick={onDone}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={isPending}>
          {isPending
            ? 'Đang xử lý…'
            : entries.length > 0
              ? `Thêm ${entries.length} ${copy.noun}`
              : `Thêm ${copy.noun}`}
        </Button>
      </FormActions>
    </div>
  );
}

function PasteTab({
  kind,
  copy,
  onDone,
}: {
  kind: ResourceKind;
  copy: TabCopy;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const parse = useMemo(() => (text.trim() ? parseImportText(text) : EMPTY_PARSE), [text]);

  return (
    <BulkPanel kind={kind} copy={copy} parse={parse} onDone={onDone}>
      {(error) => (
        <Field
          label="Danh sách"
          required
          error={error}
          info={
            <>
              Nhận dạng: bảng (tab giữa các cột) hoặc <code>mục (cách đọc) : nghĩa N5</code>. Danh
              sách lộn xộn? Nhờ Claude Desktop hoặc ChatGPT dọn hộ bằng prompt{' '}
              <code>import_grammar</code>.
            </>
          }
        >
          <Textarea
            id="paste-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={copy.pastePlaceholder}
          />
        </Field>
      )}
    </BulkPanel>
  );
}

function ExcelTab({
  kind,
  copy,
  onDone,
}: {
  kind: ResourceKind;
  copy: TabCopy;
  onDone: () => void;
}) {
  const [fileResult, setFileResult] = useState<{ name: string; result: ParseResult } | null>(null);
  const [isReading, startReading] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    setFileResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFileChange = (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.set('file', file);
    startReading(async () => {
      const result = await parseExcelAction(formData);
      if (!toastResult(result, (d) => `Đã đọc ${d.entries.length} mục từ ${file.name}`)) {
        clearFile();
        return;
      }
      setFileResult({ name: file.name, result: result.data });
    });
  };

  return (
    <BulkPanel kind={kind} copy={copy} parse={fileResult?.result ?? EMPTY_PARSE} onDone={onDone}>
      {(error) => (
        <div className="flex flex-wrap items-center gap-3">
          <Field
            label="File Excel (.xlsx)"
            required
            error={error}
            info="File Excel tải từ Mazii."
            className="min-w-0"
          >
            <input
              ref={fileInputRef}
              id="excel-file"
              type="file"
              accept=".xlsx"
              disabled={isReading}
              className="block text-sm file:mr-3 file:rounded-md file:border file:border-border/70 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-secondary/60"
              onChange={(e) => onFileChange(e.target.files?.[0])}
            />
          </Field>
          {fileResult && (
            <Badge variant="secondary" className="min-w-0 gap-1">
              <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{fileResult.name}</span>
              <button type="button" aria-label="Bỏ file" onClick={clearFile}>
                <X className="size-3.5 shrink-0" aria-hidden />
              </button>
            </Badge>
          )}
        </div>
      )}
    </BulkPanel>
  );
}
