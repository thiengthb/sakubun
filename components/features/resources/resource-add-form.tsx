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
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormActions } from '@/components/common/field';
import {
  EMPTY_DRAFT,
  ITEM_COPY,
  ItemFields,
  useItemDraft,
  type ItemKind,
} from '@/components/features/resources/item-fields';

export type ResourceKind = ItemKind;

const COPY: Record<
  ResourceKind,
  {
    noun: string; // singular unit for counts/buttons ("mẫu" / "từ")
    pastePlaceholder: string;
  }
> = {
  grammar: {
    noun: 'mẫu',
    pastePlaceholder:
      'Dán thẳng các dòng copy từ Excel Mazii (word ⇥ phonetic ⇥ mean ⇥ comment), hoặc mỗi dòng một mục:\n〜ばかりに: chỉ vì… (hậu quả xấu) N2\n〜わけにはいかない: không thể… (vì lý do tâm lý) N3',
  },
  vocab: {
    noun: 'từ',
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
  const { draft, set, errors, check, reset } = useItemDraft(kind, EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!check(e.currentTarget, 'add')) return;
    startTransition(async () => {
      const r = await addOneItemAction(
        {
          expression: draft.expression,
          reading: draft.reading.trim() || undefined,
          meaningVi: draft.meaningVi,
          level: draft.level || undefined,
          notes: draft.notes.trim() || undefined,
        },
        kind,
      );
      if (toastResult(r, `Đã thêm ${copy.noun} vào kho`)) {
        reset();
        onDone();
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="@container space-y-4">
      <ItemFields kind={kind} draft={draft} set={set} errors={errors} idPrefix="add" autoFocus />
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
                Cấp JLPT mặc định
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
                    <TableHead>{ITEM_COPY[kind].exprLabel}</TableHead>
                    <TableHead>Cách đọc</TableHead>
                    <TableHead>Nghĩa</TableHead>
                    <TableHead>Cấp JLPT</TableHead>
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
        <Field label="File Excel (.xlsx)" required error={error} info="File Excel tải từ Mazii.">
          <div role="group" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <Input
              type="file"
              ref={fileInputRef}
              id="excel-file"
              accept=".xlsx"
              wrapperClassName="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isReading}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet aria-hidden />
              {isReading ? 'Đang đọc…' : fileResult ? 'Chọn file khác' : 'Chọn file'}
            </Button>
            {fileResult ? (
              <span className="flex min-w-0 items-center gap-1 text-sm">
                <span className="min-w-0 truncate">{fileResult.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Bỏ file"
                  onClick={clearFile}
                >
                  <X aria-hidden />
                </Button>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Chưa chọn file</span>
            )}
          </div>
        </Field>
      )}
    </BulkPanel>
  );
}
