import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTimeVN } from '@/lib/format';
import type { ToolUsageReport } from '@/lib/mcp/usage';

function ms(value: number | null): string {
  if (value === null) return '—';
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

export function McpUsageCard({ usage }: { usage: ToolUsageReport }) {
  const totalCalls = usage.rows.reduce((sum, r) => sum + r.calls, 0);
  const failing = usage.rows.filter((r) => r.errors > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoạt động MCP</CardTitle>
        <CardDescription>
          Mỗi lần Claude gọi một tool của sakubun, lần gọi đó được đếm ở đây. Bảng này nằm trong cơ
          sở dữ liệu nên nó SỐNG QUA việc khởi động lại app — khác với log, thứ biến mất cùng
          container. Dùng nó để biết Claude thật sự dùng gì, và để thấy tool nào đang lỗi (một tool
          lỗi vẫn trả kết quả &quot;thành công&quot; ở tầng HTTP, nên đây là chỗ duy nhất thấy được).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa ghi nhận lời gọi nào. Nối Claude Desktop bằng token ở trên rồi luyện một lượt, số sẽ
            xuất hiện ở đây.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {totalCalls} lời gọi · {usage.rows.length}/{usage.toolCount} tool đã được dùng
              {failing.length > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-destructive">
                    {failing.length} tool có lỗi
                  </span>
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
                            (không còn trong bản đồ tool)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${r.errors > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
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
          <div className="space-y-1 border-t pt-4">
            <p className="text-sm">
              {usage.neverCalled.length}/{usage.toolCount} tool CHƯA BAO GIỜ được gọi
            </p>
            <p className="font-mono text-xs break-words text-muted-foreground">
              {usage.neverCalled.join(' · ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
