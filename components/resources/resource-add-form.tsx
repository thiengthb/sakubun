'use client';

import { type ReactNode, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, X } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { addOneItemAction, importItemsAction, parseExcelAction } from '@/app/actions';
import { parseImportText, type ParsedEntry, type ParseResult } from '@/lib/import-parse';
import { JLPT_LEVELS, type JlptLevel } from '@/lib/settings-schema';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export const INPUT_TABS = [
  { value: 'single', label: 'Theo trường' },
  { value: 'paste', label: 'Dán danh sách' },
  { value: 'excel', label: 'Nhập Excel' },
] as const;

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

export function ResourceAddForm({ kind, onDone }: { kind: ResourceKind; onDone?: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>('single');
  const close =
    onDone ??
    (() => {
      router.push('/resources');
      router.refresh();
    });

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-4">
      <TabSelect items={INPUT_TABS} value={tab} onValueChange={setTab} label="Cách nhập" />
      <ResourceAddPanels kind={kind} onDone={close} />
    </Tabs>
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

  const canSubmit = expression.trim() !== '' && meaningVi.trim() !== '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
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
        onDone();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.exprLabel}>
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            lang="ja"
            placeholder={copy.exprPlaceholder}
            autoFocus
            required
          />
        </Field>
        <Field label="Cách đọc (kana)" hint="Không bắt buộc">
          <Input
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            lang="ja"
            placeholder={copy.readingPlaceholder}
          />
        </Field>
        <Field label="Nghĩa (tiếng Việt)" className="sm:col-span-2">
          <Input
            value={meaningVi}
            onChange={(e) => setMeaningVi(e.target.value)}
            placeholder={copy.meaningPlaceholder}
            required
          />
        </Field>
        <Field label="Cấp độ" hint="Không bắt buộc">
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
        <Field label="Ghi chú" hint="Không bắt buộc" className="sm:col-span-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Sắc thái, cách dùng, ví dụ ngắn…"
          />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={isPending} onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending ? 'Đang thêm…' : `Thêm ${copy.noun}`}
        </Button>
      </div>
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
  children: ReactNode; // the input control (textarea / file picker)
}) {
  const [defaultLevel, setDefaultLevel] = useState<JlptLevel>('N5');
  const [isPending, startTransition] = useTransition();

  const entries: ParsedEntry[] = parse.entries.map((e) => ({
    ...e,
    level: e.level ?? defaultLevel,
  }));
  const hasResult = parse.entries.length > 0 || parse.errors.length > 0;

  const submit = () => {
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
      {children}

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
              <Label htmlFor="bulk-default-level" className="text-xs text-muted-foreground">
                Cấp độ mặc định
              </Label>
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

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={isPending} onClick={onDone}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={isPending || entries.length === 0}>
          {isPending ? 'Đang xử lý…' : `Thêm ${entries.length} ${copy.noun} vào kho`}
        </Button>
      </div>
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
      <div className="space-y-2">
        <Label htmlFor="paste-text">Dán danh sách</Label>
        <Textarea
          id="paste-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={copy.pastePlaceholder}
        />
        <p className="text-xs text-muted-foreground">
          Nhận dạng: bảng (tab giữa các cột) hoặc <code>mục (cách đọc) : nghĩa N5</code>. Danh sách
          lộn xộn? Nhờ Claude Desktop dọn hộ bằng prompt <code>import_grammar</code>.
        </p>
      </div>
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="excel-file">File Excel tải từ Mazii (.xlsx)</Label>
          <input
            ref={fileInputRef}
            id="excel-file"
            type="file"
            accept=".xlsx"
            disabled={isReading}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-border/70 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-secondary/60"
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
        </div>
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
    </BulkPanel>
  );
}
