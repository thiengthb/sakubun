'use client';

import { useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
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
import { SettingsTab } from '@/components/features/settings/settings-tab';
import { cn } from '@/lib/core/utils';

const RESTORE_COMMANDS = `docker compose down
docker run --rm -v sakubun_sakubun_data:/data -v "$PWD":/backup alpine \\
  sh -c "cp /backup/sakubun-YYYY-MM-DD.db /data/sakubun.db"
docker compose up -d`;

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
type ImportKind = 'learning' | 'full';

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

function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="font-heading text-sm font-semibold">{children}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

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

async function postImport(kind: ImportKind, file: File, dryRun: boolean): Promise<ImportResult> {
  const path = kind === 'learning' ? '/api/import/mine' : '/api/import/system';
  const res = await fetch(`${path}?dryRun=${dryRun ? '1' : '0'}`, { method: 'POST', body: file });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Lỗi ${res.status}`);
  return json as ImportResult;
}

export function DataTab() {
  const router = useRouter();
  const [busy, setBusy] = useState<'learning' | 'anki' | 'full' | 'sync' | null>(null);
  const [preview, setPreview] = useState<{
    kind: ImportKind;
    file: File;
    result: ImportResult;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const learningInput = useRef<HTMLInputElement>(null);
  const fullInput = useRef<HTMLInputElement>(null);

  const exportAnki = async () => {
    setBusy('anki');
    try {
      const { name, items } = await downloadFrom('/api/export/anki', 'sakubun-vocab.apkg');
      toast.success(`Đã tải ${name}`, {
        description:
          items === '0'
            ? 'Chưa có từ vựng nào để xuất — hãy nhờ trợ lý MCP thêm từ trước.'
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

  const exportLearning = async () => {
    setBusy('learning');
    try {
      const { name, items } = await downloadFrom('/api/export/mine', 'sakubun-my-data.json');
      toast.success(`Đã tải ${name}`, {
        description: `${items ?? '?'} mục học. Hãy chép sang một ổ khác hoặc lên cloud.`,
      });
    } catch {
      toast.error('Không tạo được bản xuất dữ liệu', {
        description: 'Thử lại sau hoặc xem log của container.',
      });
    } finally {
      setBusy(null);
    }
  };

  const backupFull = async () => {
    setBusy('full');
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

  const confirmSync = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const result = await postImport(preview.kind, preview.file, false);
      const added = result.tables.reduce((n, t) => n + t.create, 0);
      const updated = result.tables.reduce((n, t) => n + t.update, 0);
      toast.success('Đã nạp xong', {
        description:
          preview.kind === 'full'
            ? `Thêm mới ${added} bản ghi. Không có gì bị xóa hay ghi đè.`
            : `Thêm mới ${added} bản ghi, cập nhật ${updated}. Không có gì bị xóa.`,
      });
      setPreview(null);
      router.refresh();
    } catch (err) {
      toast.error('Nạp dữ liệu thất bại', {
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
  const showUpdates = preview?.kind === 'learning';

  return (
    <SettingsTab value="data" surface="bare">
      <div className="space-y-6">
        <section className="space-y-3">
          <SectionHeading hint="Những gì bạn đã xây được trong app, ở dạng tệp mang đi được.">
            Dữ liệu học
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={FileDown} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Bản sao dữ liệu học (JSON)</CardTitle>
                    <CardDescription className="text-xs">
                      Từ vựng và ngữ pháp đã thêm, lịch ôn FSRS, lịch sử ôn, câu đã luyện, nhóm và
                      cài đặt. Nạp lại là <span className="font-medium text-foreground">gộp</span> —
                      thêm cái thiếu, cập nhật cái đã có, không xóa gì; bạn xem trước rồi mới xác
                      nhận.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto flex-wrap gap-2">
                <Button onClick={exportLearning} disabled={busy !== null}>
                  <FileDown className="size-4" aria-hidden />
                  {busy === 'learning' ? 'Đang tạo…' : 'Tải JSON'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => learningInput.current?.click()}
                  disabled={busy !== null}
                >
                  {busy === 'sync' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileUp className="size-4" aria-hidden />
                  )}
                  Nạp từ tệp JSON
                </Button>
                <input
                  ref={learningInput}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    void pickForSync('learning', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </CardFooter>
            </Card>

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

        <section className="space-y-3">
          <SectionHeading hint="Bản sao đầy đủ duy nhất: có cả tài khoản đăng nhập, khóa MCP và ghi chú gia sư. Nạp vào chỉ THÊM, không ghi đè, không xóa.">
            Toàn bộ tệp dữ liệu
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Database} />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Sao lưu toàn bộ (.db)</CardTitle>
                    <CardDescription className="text-xs">
                      Ảnh chụp SQLite nhất quán của toàn bộ cơ sở dữ liệu, đã kiểm tra toàn vẹn
                      trước khi trao cho bạn. Đây là bản duy nhất khôi phục lại được đúng mọi thứ —
                      tệp nằm cùng ổ với Docker, nhớ chép tiếp sang ổ khác hoặc cloud.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button onClick={backupFull} disabled={busy !== null}>
                  <Database className="size-4" aria-hidden />
                  {busy === 'full' ? 'Đang tạo…' : 'Tải bản sao lưu'}
                </Button>
              </CardFooter>
            </Card>

            <Card className="ring-warn/30">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Upload} tone="warn" />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-sm">Nạp thêm từ tệp .db</CardTitle>
                    <CardDescription className="text-xs">
                      Gộp một tệp <code className="text-foreground">.db</code> vào cơ sở dữ liệu
                      đang chạy: <span className="font-medium text-foreground">chỉ thêm</span> bản
                      ghi còn thiếu, những gì đã có được giữ nguyên. Tệp mang theo cả tài khoản
                      trong đó — hãy sao lưu trước và xem kỹ bảng thay đổi rồi mới xác nhận.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button
                  variant="outline"
                  onClick={() => fullInput.current?.click()}
                  disabled={busy !== null}
                >
                  {busy === 'sync' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-4" aria-hidden />
                  )}
                  Chọn tệp .db
                </Button>
                <input
                  ref={fullInput}
                  type="file"
                  accept=".db,application/vnd.sqlite3,application/octet-stream"
                  className="hidden"
                  onChange={(e) => {
                    void pickForSync('full', e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </CardFooter>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <IconBadge icon={HardDriveDownload} />
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-sm">Khôi phục nguyên trạng (nâng cao)</CardTitle>
                  <CardDescription className="text-xs">
                    Thay hẳn cơ sở dữ liệu bằng một bản sao lưu — mất mọi thay đổi phát sinh sau bản
                    đó. Chỉ dùng khi cần quay về đúng một thời điểm. App không tự làm được việc này:
                    tiến trình đang giữ tệp DB mở, nên phải thay từ ngoài container.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <details className="group/restore rounded-lg border border-border/70 bg-muted/30">
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
                    Muốn chắc một bản sao lưu còn dùng được: bấm{' '}
                    <span className="text-foreground">Chọn tệp .db</span> ở thẻ trên và chọn chính
                    tệp đó. Bước xem trước kiểm tra toàn vẹn tệp rồi đếm từng bảng mà không ghi gì —
                    tệp hỏng sẽ báo lỗi ngay, còn “không có gì mới” nghĩa là nó khớp đúng dữ liệu
                    hiện tại. Bấm Hủy để kết thúc.
                  </p>
                </div>
              </details>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && !applying && setPreview(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Xem trước thay đổi</DialogTitle>
            <DialogDescription>
              {preview?.kind === 'full'
                ? 'Gộp một tệp .db vào cơ sở dữ liệu đang chạy. Chưa có gì được ghi — đây là những thay đổi sẽ xảy ra.'
                : 'Gộp một bản sao dữ liệu học vào app. Chưa có gì được ghi — đây là những thay đổi sẽ xảy ra.'}
            </DialogDescription>
          </DialogHeader>

          {previewTotals && (
            <p className="text-sm">
              Sẽ <span className="font-medium text-primary">thêm {previewTotals.create}</span>
              {showUpdates && (
                <>
                  , cập nhật <span className="font-medium">{previewTotals.update}</span>
                </>
              )}
              , bỏ qua <span className="font-medium">{previewTotals.skip}</span> bản ghi.{' '}
              <span className="text-muted-foreground">
                {showUpdates ? 'Không xóa gì.' : 'Không xóa, không ghi đè bản ghi đã có.'}
              </span>
            </p>
          )}

          {nonEmpty.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bảng</TableHead>
                    <TableHead className="text-right">Thêm</TableHead>
                    {showUpdates && <TableHead className="text-right">Cập nhật</TableHead>}
                    <TableHead className="text-right">Bỏ qua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonEmpty.map((t) => (
                    <TableRow key={t.table}>
                      <TableCell className="font-medium">{t.table}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.create || '—'}</TableCell>
                      {showUpdates && (
                        <TableCell className="text-right tabular-nums">{t.update || '—'}</TableCell>
                      )}
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
              Tệp này không có gì mới so với dữ liệu hiện tại — không cần nạp.
            </p>
          )}

          {preview && preview.result.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs">
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
              {applying ? 'Đang nạp…' : 'Xác nhận nạp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsTab>
  );
}
