'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { EditorView } from '@codemirror/view';
import { Check, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field } from '@/components/common/field';
import { FormGuide, GuideSample } from '@/components/common/form-guide';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { RelativeTime } from '@/components/common/relative-time';
import { ShortcutsHelp, type Shortcut } from '@/components/common/shortcuts-help';
import { useLocalState } from '@/components/common/use-session-state';
import { useServerAction } from '@/components/common/use-server-action';
import { KaiwaChat } from '@/components/features/kaiwa/kaiwa-chat';
import { ScriptEditor, type EditorStatus } from '@/components/features/kaiwa/script-editor';
import { editScriptCommand } from '@/components/features/kaiwa/kaiwa-commands';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import { deleteScriptAction, saveScriptAction } from '@/app/kaiwa/actions';
import { toastResult } from '@/lib/core/action-toast';
import { cn } from '@/lib/core/utils';
import { scriptSpeakers } from '@/lib/kaiwa/layout';
import {
  checkBody,
  checkTitle,
  describeProblems,
  normalizeBody,
  parseScript,
  SCRIPT_LIMITS,
} from '@/lib/kaiwa/parse';

export interface CanvasScript {
  id: string;
  version: number;
  title: string;
  body: string;
  updatedAt: Date;
  /** The saved lines with the furigana worked out on save, for reading. */
  lines: RubyLine[];
}

const VIEW_KEYS: Shortcut[] = [
  { keys: ['Ctrl', 'E'], does: 'Sửa kịch bản' },
  { keys: ['↑', '↓'], does: 'Chọn câu' },
  { keys: ['Enter'], does: 'Nghe câu đang chọn' },
];
const EDIT_KEYS: Shortcut[] = [
  { keys: ['Ctrl', 'S'], does: 'Lưu' },
  { keys: ['Ctrl', 'E'], does: 'Xong, về chế độ xem' },
  { keys: ['Ctrl', 'F'], does: 'Tìm và thay' },
  { keys: ['Ctrl', 'D'], does: 'Chọn thêm chỗ giống chữ đang chọn' },
  { keys: ['Alt', 'bấm'], does: 'Thêm con trỏ' },
  { keys: ['Ctrl', 'Z'], does: 'Hoàn tác' },
  { keys: ['Ctrl', 'Shift', 'Z'], does: 'Làm lại' },
];

// The bounds of the editor's share of the width, in percent (the old canvas's 25 to 75).
const SPLIT = { min: 25, max: 75, initial: 50 };

// Hội thoại on one canvas (thien, 7.4f, after the old kaiwa-canvas): a script is read here, and
// Sửa (Ctrl E) opens its text on the left and a live preview on the right, with a bar between them
// to drag. Lưu or Ctrl S saves, never by itself: each save works the furigana out again, and a
// version the AI saved meanwhile is never overwritten. A phone switches between Viết and Xem trước.
export function KaiwaCanvas({
  script,
  startEditing,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  /** Absent: a new script, written from scratch. */
  script?: CanvasScript;
  startEditing: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing || !script);
  const [title, setTitle] = useState(script?.title ?? '');
  const [body, setBody] = useState(script?.body ?? '');
  const [saved, setSaved] = useState({
    title: script?.title ?? '',
    body: script?.body ?? '',
    version: script?.version,
  });
  const [cursor, setCursor] = useState<EditorStatus>({ row: 1, column: 1 });
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [split, setSplit] = useLocalState<number>('kaiwa-split', SPLIT.initial);
  const [confirm, setConfirm] = useState<'delete' | 'discard' | null>(null);
  const [pending, startTransition] = useTransition();
  const editor = useRef<EditorView | null>(null);
  const remove = useServerAction(deleteScriptAction, {
    success: 'Đã xoá kịch bản',
    onSuccess: () => router.push('/kaiwa'),
  });

  const draft = parseScript(body);
  const draftLines: RubyLine[] = draft.map((line) => ({ ...line, ruby: line.japanese }));
  const speakers = scriptSpeakers(draft);
  const problems = body.trim() ? checkBody(normalizeBody(body)) : [];
  const titleError = title.trim() ? describeProblems(checkTitle(title)) || null : null;
  const dirty = title.trim() !== saved.title || normalizeBody(body) !== saved.body;
  const ready = dirty && !!title.trim() && !!body.trim() && !titleError && problems.length === 0;

  const save = () => {
    if (pending) return;
    if (!dirty && script) return;
    const all = [...checkTitle(title), ...checkBody(normalizeBody(body))];
    if (all.length > 0) {
      toast.error(describeProblems(all));
      return;
    }
    startTransition(async () => {
      const result = await saveScriptAction({
        id: script?.id,
        version: saved.version,
        title,
        body,
      });
      if (!toastResult(result, script ? 'Đã lưu' : 'Đã thêm kịch bản')) return;
      if (!script) {
        router.push(`/kaiwa/${result.data.id}`);
        return;
      }
      setSaved({
        title: result.data.title,
        body: normalizeBody(body),
        version: result.data.version,
      });
      router.refresh();
    });
  };

  // The URL says which mode is open, so a reload or a shared link comes back to it.
  const switchTo = (edit: boolean) => {
    if (!script) return;
    setEditing(edit);
    window.history.replaceState(
      null,
      '',
      edit ? `/kaiwa/${script.id}?edit=1` : `/kaiwa/${script.id}`,
    );
  };
  const leaveEditing = () => {
    if (dirty) setConfirm('discard');
    else switchTo(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'e' && script) {
        e.preventDefault();
        if (editing) leaveEditing();
        else switchTo(true);
      } else if (key === 's' && editing) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Leaving the page with changes not saved asks first.
  useEffect(() => {
    if (!editing || !dirty) return;
    const stay = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', stay);
    return () => window.removeEventListener('beforeunload', stay);
  }, [editing, dirty]);

  const jumpTo = (row: number) => {
    const view = editor.current;
    if (!view || row > view.state.doc.lines) return;
    const line = view.state.doc.line(row);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
  };
  const insert = (text: string, back = 0) => {
    const view = editor.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length - back },
    });
    view.focus();
  };

  // Dragging the bar between the panes, or ← → on it, sets the editor's share of the width.
  const grid = useRef<HTMLDivElement>(null);
  const clamp = (n: number) => Math.round(Math.min(SPLIT.max, Math.max(SPLIT.min, n)));
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = grid.current?.getBoundingClientRect();
    if (!box || !(e.buttons & 1)) return;
    setSplit(clamp(((e.clientX - box.left) / box.width) * 100));
  };

  const header = editing ? (
    <>
      {script && (
        <ExpandingIconButton icon={Trash2} label="Xoá" onClick={() => setConfirm('delete')} />
      )}
      {script && <ExpandingIconButton icon={Check} label="Xong" onClick={leaveEditing} />}
      <Button onClick={save} disabled={!ready || pending}>
        {script ? 'Lưu' : 'Thêm kịch bản'}
      </Button>
      <ShortcutsHelp shortcuts={script ? EDIT_KEYS : EDIT_KEYS.filter((k) => k.keys[1] !== 'E')} />
    </>
  ) : (
    <>
      <ExpandingIconButton icon={Pencil} label="Sửa" onClick={() => switchTo(true)} />
      <CopyCommandButton
        command={editScriptCommand(script!.title)}
        label="Sửa với AI"
        size="default"
        expandOnHover
        icon={Sparkles}
      />
      <ShortcutsHelp shortcuts={VIEW_KEYS} />
    </>
  );

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="kaiwa" self />}
      title={editing ? title.trim() || (script ? script.title : 'Thêm kịch bản') : script!.title}
      meta={
        script && (
          <span>
            {script.lines.length} câu · Cập nhật <RelativeTime value={script.updatedAt} />
          </span>
        )
      }
      actions={header}
      actionsOnPhone="split"
    >
      {!editing && script ? (
        <KaiwaChat
          scriptId={script.id}
          lines={script.lines}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          showFurigana={showFurigana}
        />
      ) : (
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            variant="choice"
            aria-label="Khung"
            value={tab}
            onValueChange={(v) => v && setTab(v as 'write' | 'preview')}
            className="md:hidden"
          >
            <ToggleGroupItem value="write" className="px-3">
              Viết
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" className="px-3">
              Xem trước
            </ToggleGroupItem>
          </ToggleGroup>
          <div
            ref={grid}
            data-slot="kaiwa-canvas"
            className="md:grid md:items-start"
            style={{
              gridTemplateColumns: `minmax(0, ${split}fr) 1rem minmax(0, ${100 - split}fr)`,
            }}
          >
            <section
              aria-label="Bản thảo"
              className={cn('min-w-0 space-y-3', tab !== 'write' && 'max-md:hidden')}
            >
              <Field
                label="Tiêu đề"
                required
                error={titleError}
                count={{ value: title.trim().length, max: SCRIPT_LIMITS.title }}
              >
                <Input
                  id="script-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Ở nhà hàng"
                />
              </Field>
              <div className="h-96 md:h-120 overflow-hidden rounded-lg border border-border">
                <ScriptEditor
                  initial={body}
                  onChange={setBody}
                  onSave={save}
                  onCursor={setCursor}
                  editorRef={editor}
                  placeholder={'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.'}
                />
              </div>
              <p
                data-slot="kaiwa-status"
                className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums"
              >
                <span>
                  Dòng {cursor.row}, cột {cursor.column}
                </span>
                <span>
                  {draft.length} câu ·{' '}
                  {speakers.length > 0 ? `Người nói: ${speakers.join(', ')}` : 'Độc thoại'}
                </span>
                <span className={cn(problems.length > 0 && 'text-destructive')}>
                  {problems.length} lỗi
                </span>
                <span className="ml-auto">
                  {body.length}/{SCRIPT_LIMITS.body}
                </span>
              </p>
              {problems.length > 0 && (
                <div role="alert" className="space-y-0.5 text-sm text-destructive">
                  {describeProblems(problems)
                    .split('\n')
                    .map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                </div>
              )}
              {/* A phone's keyboard has no quick way to these: the speakers so far, the bar, a reading. */}
              <div
                aria-label="Chèn nhanh"
                role="toolbar"
                className="sticky bottom-0 flex gap-1.5 overflow-x-auto bg-background py-2 md:hidden"
              >
                {speakers.map((s) => (
                  <Button key={s} variant="outline" onClick={() => insert(`${s}: `)}>
                    {s}:
                  </Button>
                ))}
                <Button variant="outline" onClick={() => insert(' | ')}>
                  |
                </Button>
                <Button variant="outline" onClick={() => insert('[]', 1)}>
                  [ ]
                </Button>
              </div>
            </section>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Kéo để chia khung"
              aria-valuenow={split}
              aria-valuemin={SPLIT.min}
              aria-valuemax={SPLIT.max}
              tabIndex={0}
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={drag}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSplit((n) => clamp(n - 5));
                if (e.key === 'ArrowRight') setSplit((n) => clamp(n + 5));
              }}
              className="group/split hidden h-96 cursor-col-resize md:h-120 justify-center outline-none md:flex"
            >
              <span className="w-px bg-border group-hover/split:w-0.5 group-hover/split:bg-accent-brand group-focus-visible/split:w-0.5 group-focus-visible/split:bg-ring" />
            </div>
            <section
              aria-label="Xem trước"
              className={cn('min-w-0', tab !== 'preview' && 'max-md:hidden')}
            >
              <KaiwaChat
                scriptId={script?.id ?? null}
                lines={draftLines}
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
                showFurigana={showFurigana}
                preview={{ row: cursor.row, onPick: jumpTo }}
              />
            </section>
          </div>
          <FormGuide items={GUIDE} />
        </div>
      )}
      {script && (
        <>
          <ConfirmDialog
            open={confirm === 'delete'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title="Xoá kịch bản này?"
            description={`"${script.title}" sẽ mất hẳn, không lấy lại được.`}
            confirmLabel="Xoá"
            pending={remove.isPending}
            onConfirm={() => remove.run(script.id)}
          />
          <ConfirmDialog
            open={confirm === 'discard'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title="Bỏ những thay đổi chưa lưu?"
            description="Bản thảo về lại bản đã lưu gần nhất."
            confirmLabel="Bỏ thay đổi"
            cancelLabel="Ở lại sửa"
            onConfirm={() => {
              setConfirm(null);
              setTitle(saved.title);
              setBody(saved.body);
              switchTo(false);
            }}
          />
        </>
      )}
    </PageShell>
  );
}

const GUIDE = [
  {
    term: 'Mỗi dòng một câu',
    text: (
      <>
        Người nói, câu tiếng Nhật, rồi nghĩa sau dấu |:{' '}
        <GuideSample>A: いらっしゃいませ。 | Xin mời vào.</GuideSample>
      </>
    ),
  },
  {
    term: 'Người nói',
    text: 'Một hai chữ cái (A, B) hoặc tên tiếng Nhật (田中). Gõ đầu dòng thì tên đã có hiện ra để chọn.',
  },
  {
    term: 'Bối cảnh',
    text: (
      <>
        Dòng không có người nói nằm giữa hội thoại, như{' '}
        <GuideSample>店の中は静かだった。 | Trong quán yên tĩnh.</GuideSample>
      </>
    ),
  },
  {
    term: 'Furigana',
    text: (
      <>
        Tự có khi lưu. Muốn đọc khác thì viết ngay sau chữ Hán:{' '}
        <GuideSample>二人[ふたり]</GuideSample>
      </>
    ),
  },
  {
    term: 'Sửa cùng AI',
    text: 'Nếu AI vừa lưu bản mới trong lúc bạn sửa, nút lưu báo lỗi để không ghi đè. Tải lại trang rồi sửa trên bản mới.',
  },
  {
    term: 'Giới hạn',
    text: `Tiêu đề ${SCRIPT_LIMITS.title} ký tự, tối đa ${SCRIPT_LIMITS.lines} dòng, mỗi câu ${SCRIPT_LIMITS.japanese} ký tự.`,
  },
];
