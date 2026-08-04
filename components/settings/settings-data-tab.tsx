'use client';

import { useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  FileDown,
  FileUp,
  HardDriveDownload,
  Layers,
  Loader2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// The volume is `sakubun_sakubun_data` — compose prefixes a named volume with the project name, so
// the bare name from docker-compose.yml is NOT what exists on the host. Getting this wrong makes
// `docker run` silently create an EMPTY volume and restore into nothing, which is why the command is
// spelled out here rather than paraphrased.
const RESTORE_COMMANDS = `docker compose down
docker run --rm -v sakubun_sakubun_data:/data -v "$PWD":/backup alpine \\
  sh -c "cp /backup/sakubun-YYYY-MM-DD.db /data/sakubun.db"
docker compose up -d`;

/** Per-table diff the server returns from an import (dry-run or applied). */
interface TableDiff {
  table: string;
  create: number;
  update: number;
  skip: number;
}
interface ImportResult {
  dryRun: boolean;
  tables: TableDiff[];
  warnings: string[];
}
type ImportKind = 'mine' | 'system';

/** A small tinted icon chip that heads each data card — gives the tab a scannable visual rhythm. */
function IconBadge({
  icon: Icon,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'warn';
}) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-primary/10 text-primary',
      )}
    >
      <Icon className="size-4.5" />
    </span>
  );
}

/** Section heading for a group of data cards — a title (item label) with its description below. */
function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="font-heading text-sm font-semibold">{children}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Trigger a browser download of a fetched attachment; returns the filename + item count for the toast. */
async function downloadFrom(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const items = res.headers.get('X-Sakubun-Items');
  const blob = await res.blob();
  const name =
    res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  a.click();
  URL.revokeObjectURL(objectUrl);
  return { name, items, size: blob.size };
}

/** POST a backup file to its import endpoint. `dryRun` asks for counts only; otherwise it applies. */
async function postImport(kind: ImportKind, file: File, dryRun: boolean): Promise<ImportResult> {
  const path = kind === 'mine' ? '/api/import/mine' : '/api/import/system';
  const res = await fetch(`${path}?dryRun=${dryRun ? '1' : '0'}`, { method: 'POST', body: file });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Lỗi ${res.status}`);
  return json as ImportResult;
}

/**
 * Tab "Dữ liệu": get a copy of your data out, and sync a backup back in.
 *
 * Single user: the whole-DB SQLite snapshot + system sync (/api/backup, /api/import/system) were
 * admin-only while the app was multi-user. With one operator there is no one to gate them from, so
 * they render unconditionally alongside the JSON/Anki export of your own data.
 *
 * Sync (2026-07-23) is a MERGE, never a delete: rows missing locally are added, existing rows are
 * updated, review history is only ever appended (invariant #2). Every sync first runs a DRY-RUN and
 * shows exactly what would change, and only writes after the user confirms in the dialog.
 *
 * Layout (2026-07-24): a scannable card grid — "Dữ liệu của bạn" (JSON copy + Anki) plus a
 * "Toàn bộ dữ liệu" group (whole-DB backup, sync, manual restore).
 */
export function DataTab() {
  const router = useRouter();
  const [busy, setBusy] = useState<'mine' | 'anki' | 'all' | 'sync' | null>(null);
  const [preview, setPreview] = useState<{
    kind: ImportKind;
    file: File;
    result: ImportResult;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const mineInput = useRef<HTMLInputElement>(null);
  const systemInput = useRef<HTMLInputElement>(null);

  const exportAnki = async () => {
    setBusy('anki');
    try {
      const { name, items } = await downloadFrom('/api/export/anki', 'sakubun-vocab.apkg');
      toast.success(`Đã tải ${name}`, {
        description:
          items === '0'
            ? 'Chưa có từ vựng nào để xuất — hãy nhờ Claude thêm từ trước.'
            : `${items} từ. Mở tệp bằng Anki để nhập vào bộ thẻ "sakubun".`,
      });
    } catch {
      toast.error('Không tạo được tệp Anki', {
        description: 'Thử lại sau hoặc xem log của container.',
      });
    } finally {
      setBusy(null);
    }
  };

  const exportMine = async () => {
    setBusy('mine');
    try {
      const { name, items } = await downloadFrom('/api/export/mine', 'sakubun-my-data.json');
      toast.success(`Đã tải ${name}`, {
        description: `${items ?? '?'} mục của bạn. Hãy chép sang một ổ khác hoặc lên cloud.`,
      });
    } catch {
      toast.error('Không tạo được bản xuất dữ liệu', {
        description: 'Thử lại sau hoặc xem log của container.',
      });
    } finally {
      setBusy(null);
    }
  };

  const backupAll = async () => {
    setBusy('all');
    try {
      const { name, items, size } = await downloadFrom('/api/backup', 'sakubun.db');
      const mb = (size / 1024 / 1024).toFixed(1);
      toast.success(`Đã tải ${name}`, {
        description: `${items ?? '?'} mục, ${mb} MB. Hãy chép sang một ổ khác hoặc lên cloud.`,
      });
    } catch {
      toast.error('Không tạo được bản sao lưu', {
        description: 'Xem log của container để biết chi tiết.',
      });
    } finally {
      setBusy(null);
    }
  };

  // Step 1 of a sync: read the picked file and ask the server what WOULD change (dry-run), then open
  // the confirmation dialog. Nothing is written yet.
  const pickForSync = async (kind: ImportKind, file: File | null) => {
    if (!file) return;
    setBusy('sync');
    try {
      const result = await postImport(kind, file, true);
      setPreview({ kind, file, result });
    } catch (err) {
      toast.error('Không đọc được tệp sao lưu', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  // Step 2: the user confirmed. Apply for real, report what landed, then refresh so the new data shows.
  const confirmSync = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const result = await postImport(preview.kind, preview.file, false);
      const added = result.tables.reduce((n, t) => n + t.create, 0);
      const updated = result.tables.reduce((n, t) => n + t.update, 0);
      toast.success('Đã đồng bộ xong', {
        description: `Thêm mới ${added} bản ghi, cập nhật ${updated}. Không có gì bị xóa.`,
      });
      setPreview(null);
      router.refresh();
    } catch (err) {
      toast.error('Đồng bộ thất bại', {
        description: err instanceof Error ? err.message : 'Không có thay đổi nào được ghi.',
      });
    } finally {
      setApplying(false);
    }
  };

  const previewTotals = preview
    ? {
        create: preview.result.tables.reduce((n, t) => n + t.create, 0),
        update: preview.result.tables.reduce((n, t) => n + t.update, 0),
        skip: preview.result.tables.reduce((n, t) => n + t.skip, 0),
      }
    : null;
  const nonEmpty = preview?.result.tables.filter((t) => t.create + t.update + t.skip > 0) ?? [];

  return (
    <TabsContent value="data" className="pt-2">
      <div className="space-y-8">
        {/* ---- Everyone: your own data ---- */}
        <section className="space-y-3">
          <SectionHeading hint="Chỉ dữ liệu của tài khoản bạn — không đụng tới người khác.">
            Dữ liệu của bạn
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* JSON copy + sync */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={FileDown} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Bản sao dữ liệu (JSON)</CardTitle>
                    <CardDescription className="text-xs">
                      Từ đã thêm, lịch ôn FSRS, lịch sử luyện, câu, cài đặt và nhóm. Đồng bộ lại là{' '}
                      <span className="font-medium text-foreground">gộp</span> — thêm cái thiếu, cập
                      nhật cái có, không xóa gì; bạn xem trước rồi mới xác nhận.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto flex-wrap gap-2">
                <Button onClick={exportMine} disabled={busy !== null}>
                  <FileDown className="size-4" aria-hidden />
                  {busy === 'mine' ? 'Đang tạo…' : 'Tải JSON'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => mineInput.current?.click()}
                  disabled={busy !== null}
                >
                  {busy === 'sync' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileUp className="size-4" aria-hidden />
                  )}
                  Đồng bộ từ tệp
                </Button>
                <input
                  ref={mineInput}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    void pickForSync('mine', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </CardFooter>
            </Card>

            {/* Anki export */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Layers} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Xuất sang Anki</CardTitle>
                    <CardDescription className="text-xs">
                      Bộ thẻ <code className="text-foreground">.apkg</code> từ từ vựng đã lưu — mặt
                      trước là từ, mặt sau cách đọc, âm Hán Việt, nghĩa và ví dụ. Tải lại sẽ cập
                      nhật thẻ cũ, không tạo trùng.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button onClick={exportAnki} disabled={busy !== null}>
                  <Layers className="size-4" aria-hidden />
                  {busy === 'anki' ? 'Đang tạo…' : 'Tải bộ thẻ Anki'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* ---- Whole-DB data ---- */}
        <section className="space-y-3">
          <SectionHeading hint="Thao tác trên toàn bộ dữ liệu. Chỉ thêm / cập nhật, không bao giờ xóa.">
            Toàn bộ dữ liệu
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Whole-DB backup */}
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Download} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Sao lưu toàn bộ (.db)</CardTitle>
                    <CardDescription className="text-xs">
                      Ảnh chụp SQLite nhất quán của mọi thành viên, đã kiểm tra toàn vẹn. Nằm cùng ổ
                      với Docker — nhớ chép tiếp sang ổ khác / cloud.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button onClick={backupAll} disabled={busy !== null}>
                  <Download className="size-4" aria-hidden />
                  {busy === 'all' ? 'Đang tạo…' : 'Tải bản sao lưu'}
                </Button>
              </CardFooter>
            </Card>

            {/* System sync from a .db */}
            <Card className="ring-warn/30">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Upload} tone="warn" />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Đồng bộ hệ thống</CardTitle>
                    <CardDescription className="text-xs">
                      Gộp một tệp <code className="text-foreground">.db</code> vào hệ thống đang
                      chạy (thêm + cập nhật, không xóa). Hãy sao lưu trước và xem kỹ bảng thay đổi
                      rồi mới xác nhận.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button
                  variant="outline"
                  onClick={() => systemInput.current?.click()}
                  disabled={busy !== null}
                >
                  {busy === 'sync' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-4" aria-hidden />
                  )}
                  Chọn tệp .db để đồng bộ
                </Button>
                <input
                  ref={systemInput}
                  type="file"
                  accept=".db,application/vnd.sqlite3,application/octet-stream"
                  className="hidden"
                  onChange={(e) => {
                    void pickForSync('system', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </CardFooter>
            </Card>
          </div>

          {/* Manual restore — advanced, tucked behind a disclosure to keep the tab calm. */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <IconBadge icon={HardDriveDownload} />
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-sm">Khôi phục nguyên trạng (nâng cao)</CardTitle>
                  <CardDescription className="text-xs">
                    Thay hẳn cơ sở dữ liệu bằng một bản sao lưu — mất mọi thay đổi phát sinh sau bản
                    đó. Chỉ dùng khi cần quay về đúng một thời điểm.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <details className="group/restore rounded-xl border border-border/70 bg-muted/30">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium select-none">
                  <HardDriveDownload className="size-4 text-muted-foreground" aria-hidden />
                  Xem các lệnh thay tệp thủ công
                </summary>
                <div className="space-y-2 border-t border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">
                    Chạy ở thư mục chứa <code className="text-foreground">docker-compose.yml</code>,
                    thay tên tệp cho đúng:
                  </p>
                  <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs">
                    <code>{RESTORE_COMMANDS}</code>
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    <HardDriveDownload className="mr-1 inline size-3.5" aria-hidden />
                    Muốn chắc bản sao lưu dùng được, chạy{' '}
                    <code className="text-foreground">./scripts/verify-restore.sh</code>: nó phục
                    hồi vào một container tạm rồi đối chiếu số mục, trạng thái FSRS và lịch sử ôn
                    với bản gốc, không đụng dữ liệu thật.
                  </p>
                </div>
              </details>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Dry-run preview: shown after a file is picked, before anything is written. */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && !applying && setPreview(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Xem trước đồng bộ</DialogTitle>
            <DialogDescription>
              {preview?.kind === 'system'
                ? 'Gộp bản sao lưu toàn hệ thống. Chưa có gì được ghi — đây là những thay đổi sẽ xảy ra.'
                : 'Gộp bản sao lưu vào tài khoản bạn. Chưa có gì được ghi — đây là những thay đổi sẽ xảy ra.'}
            </DialogDescription>
          </DialogHeader>

          {previewTotals && (
            <p className="text-sm">
              Sẽ <span className="font-medium text-primary">thêm {previewTotals.create}</span>, cập
              nhật <span className="font-medium">{previewTotals.update}</span>, bỏ qua{' '}
              <span className="font-medium">{previewTotals.skip}</span> bản ghi.{' '}
              <span className="text-muted-foreground">Không xóa gì.</span>
            </p>
          )}

          {nonEmpty.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bảng</TableHead>
                    <TableHead className="text-right">Thêm</TableHead>
                    <TableHead className="text-right">Cập nhật</TableHead>
                    <TableHead className="text-right">Bỏ qua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonEmpty.map((t) => (
                    <TableRow key={t.table}>
                      <TableCell className="font-medium">{t.table}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.create || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.update || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {t.skip || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tệp này không có gì mới so với dữ liệu hiện tại — không cần đồng bộ.
            </p>
          )}

          {preview && preview.result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-warn/40 bg-warn/5 p-3 text-xs">
              {preview.result.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={applying}>
              Hủy
            </Button>
            <Button onClick={confirmSync} disabled={applying || nonEmpty.length === 0}>
              {applying && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {applying ? 'Đang đồng bộ…' : 'Xác nhận đồng bộ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
