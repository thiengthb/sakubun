'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
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
import { SettingsSection } from '@/components/features/settings/settings-section';
import { SettingRow } from '@/components/features/settings/setting-row';
import { CopyCommandButton } from '@/components/common/copy-command-button';
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

// The whole-database section (backup, merge, restore) is admin only (roadmap 7.2).
export function DataTab({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'learning' | 'anki' | 'full' | 'sync' | null>(null);
  const [preview, setPreview] = useState<{
    kind: ImportKind;
    file: File;
    result: ImportResult;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const learningInput = useRef<HTMLInputElement>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const restoreId = useId();
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
            ? `Thêm mới ${added} bản ghi. Không có gì bị xoá hay ghi đè.`
            : `Thêm mới ${added} bản ghi, cập nhật ${updated}. Không có gì bị xoá.`,
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
      <SettingsSection
        title="Dữ liệu học"
        info="Những gì bạn đã xây trong app, ở dạng tệp mang đi được."
      >
        <SettingRow
          icon={FileDown}
          label="Bản sao JSON"
          info="Mục đã thêm, lịch ôn, lịch sử ôn, nhóm và cài đặt. Nạp lại là gộp: thêm cái thiếu, cập nhật cái đã có, không xoá gì; bạn xem trước rồi mới xác nhận."
        >
          <Button variant="outline" onClick={exportLearning} disabled={busy !== null}>
            <FileDown aria-hidden />
            {busy === 'learning' ? 'Đang tạo…' : 'Tải'}
          </Button>
          <Button
            variant="outline"
            onClick={() => learningInput.current?.click()}
            disabled={busy !== null}
          >
            {busy === 'sync' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <FileUp aria-hidden />
            )}
            Nạp
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
        </SettingRow>
        <SettingRow
          icon={Layers}
          label="Anki"
          info="Bộ thẻ .apkg từ từ vựng đã lưu: mặt trước là từ, mặt sau cách đọc, Hán Việt, nghĩa và ví dụ. Tải lại thì cập nhật thẻ cũ, không tạo trùng."
        >
          <Button variant="outline" onClick={exportAnki} disabled={busy !== null}>
            <Layers aria-hidden />
            {busy === 'anki' ? 'Đang tạo…' : 'Tải'}
          </Button>
        </SettingRow>
      </SettingsSection>

      {isAdmin && (
        <SettingsSection
          title="Toàn bộ dữ liệu"
          info="Bản sao đầy đủ duy nhất, có cả tài khoản, token MCP và ghi chú gia sư."
        >
          <SettingRow
            icon={Database}
            label="Sao lưu .db"
            info="Ảnh chụp SQLite đã kiểm tra toàn vẹn. Tệp nằm cùng ổ với Docker: chép tiếp sang ổ khác hoặc cloud."
          >
            <Button variant="outline" onClick={backupFull} disabled={busy !== null}>
              <Database aria-hidden />
              {busy === 'full' ? 'Đang tạo…' : 'Tải'}
            </Button>
          </SettingRow>
          <SettingRow
            icon={Upload}
            label="Nạp .db"
            info="Chỉ thêm bản ghi còn thiếu, giữ nguyên cái đã có. Tệp mang theo cả tài khoản trong đó: sao lưu trước, xem kỹ bảng thay đổi rồi mới xác nhận."
          >
            <Button
              variant="outline"
              onClick={() => fullInput.current?.click()}
              disabled={busy !== null}
            >
              {busy === 'sync' ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Upload aria-hidden />
              )}
              Chọn tệp
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
          </SettingRow>
          <SettingRow
            icon={HardDriveDownload}
            label="Khôi phục"
            info="Thay hẳn cơ sở dữ liệu bằng một bản sao lưu, mất mọi thay đổi sau bản đó. Phải làm từ ngoài container. Muốn thử một bản sao lưu còn dùng được: Nạp .db rồi Hủy ở bước xem trước."
            className="col-span-full"
          >
            <Button
              variant="outline"
              aria-expanded={restoreOpen}
              aria-controls={restoreId}
              onClick={() => setRestoreOpen((o) => !o)}
            >
              <ChevronDown
                aria-hidden
                className={cn('transition-transform', restoreOpen && 'rotate-180')}
              />
              Lệnh
            </Button>
          </SettingRow>
          <div id={restoreId} hidden={!restoreOpen} className="col-span-full space-y-2 px-4 pb-4">
            <p className="text-xs text-muted-foreground">
              Chạy ở thư mục có <code className="text-foreground">docker-compose.yml</code>:
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-xs">
                <code>{RESTORE_COMMANDS}</code>
              </pre>
              <CopyCommandButton
                command={RESTORE_COMMANDS}
                label="Chép lệnh"
                size="icon-sm"
                showCopiedText={false}
                toastDescription="none"
                className="absolute top-2 right-2"
              />
            </div>
          </div>
        </SettingsSection>
      )}

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
                {showUpdates ? 'Không xoá gì.' : 'Không xoá, không ghi đè bản ghi đã có.'}
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
