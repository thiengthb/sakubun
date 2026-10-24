import { SettingsSection } from '@/components/features/settings/settings-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTimeVN } from '@/lib/core/format';
import type { ToolUsageReport } from '@/lib/mcp/usage';
import { cn } from '@/lib/core/utils';

function ms(value: number | null): string {
  if (value === null) return '—';
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

export function McpUsageCard({ usage }: { usage: ToolUsageReport }) {
  const totalCalls = usage.rows.reduce((sum, r) => sum + r.calls, 0);
  const failing = usage.rows.filter((r) => r.errors > 0);

  return (
    <SettingsSection
      title="Hoạt động MCP"
      info="Mỗi lần Claude hoặc ChatGPT gọi một tool, lần gọi được đếm ở đây và còn sau khi app khởi động lại. Tool lỗi vẫn trả thành công ở tầng HTTP, nên đây là chỗ duy nhất thấy được."
    >
      <div className="col-span-full space-y-4 px-4 py-3">
        {usage.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lời gọi nào.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {totalCalls} lời gọi · {usage.rows.length}/{usage.toolCount} tool đã được dùng
              {failing.length > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-destructive">{failing.length} tool có lỗi</span>
                </>
              ) : null}
            </p>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead className="text-right">Lượt gọi</TableHead>
                    <TableHead className="text-right">Lỗi</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Lần cuối</TableHead>
                    <TableHead className="whitespace-nowrap">Thời điểm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.rows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-mono text-xs">
                        {r.name}
                        {r.inCatalog ? null : (
                          <span className="ml-2 font-sans text-xs text-muted-foreground">
                            (đã bỏ)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          r.errors > 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {r.errors}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {ms(r.lastMs)}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDateTimeVN(r.lastCalledAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {failing.length > 0 && (
              <ul className="space-y-2 border-t pt-4">
                {failing.map((r) => (
                  <li key={r.name} className="text-sm">
                    <span className="font-mono text-xs">{r.name}</span>{' '}
                    <span className="text-muted-foreground">lỗi gần nhất:</span>{' '}
                    <span className="text-destructive">{r.lastError ?? 'không rõ'}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {usage.neverCalled.length > 0 && (
          <details className="border-t pt-3">
            <summary className="cursor-pointer text-sm select-none">
              {usage.neverCalled.length}/{usage.toolCount} tool chưa dùng
            </summary>
            <p className="mt-1 font-mono text-xs break-words text-muted-foreground">
              {usage.neverCalled.join(' · ')}
            </p>
          </details>
        )}
      </div>
    </SettingsSection>
  );
}
