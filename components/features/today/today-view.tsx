import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { LeadPanel } from '@/components/common/lead-panel';
import { cn } from '@/lib/core/utils';
import { APP_TIME_ZONE, formatDateVN } from '@/lib/core/format';
import type { Today } from '@/lib/insights/today';
import type { TodayHero as Hero, WeekDay } from '@/lib/insights/today-model';

// The Hôm nay page (plan 2026-11-14-u3-today, layout A as thien chose on 14/11): one lead area
// with the cards due and the start button, then the next things to do; on a laptop a right column
// with the week, what needs fixing and the next 14 days.

const WEEKDAY = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const time = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
});
const dayMonth = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  timeZone: APP_TIME_ZONE,
});

function nextDueText(at: Date | null, now: Date): string {
  if (!at) return 'Chưa có thẻ nào hẹn ngày ôn.';
  const sameDay = formatDateVN(at) === formatDateVN(now);
  return `Thẻ tiếp theo đến hạn ${sameDay ? `lúc ${time.format(at)}` : `ngày ${dayMonth.format(at)}`}.`;
}

function readyLine(hero: Extract<Hero, { kind: 'ready' }>): string {
  const parts = [
    hero.newGrammar > 0 && `${hero.newGrammar} mẫu mới`,
    hero.newVocab > 0 && `${hero.newVocab} từ mới`,
    hero.newKanji > 0 && `${hero.newKanji} kanji mới`,
  ].filter(Boolean);
  const done = hero.resume ? `Đã ôn ${hero.reviewedToday} thẻ hôm nay · ` : '';
  const fresh = parts.length ? `${parts.join(', ')} · ` : '';
  return `${done}${fresh}khoảng ${hero.minutes} phút`;
}

/** The lead area: the one place the eye goes first. */
export function TodayHero({ hero, now }: { hero: Hero; now: Date }) {
  if (hero.kind === 'empty') return null;
  if (hero.kind === 'done' && hero.reviewedToday === 0) {
    // Nothing was due and nothing was studied: no praise for a day that has not happened yet.
    return (
      <LeadPanel aria-label="Hôm nay">
        <p className="text-sm font-medium text-accent-brand">Hôm nay</p>
        <p className="mt-1 text-title">Không có thẻ nào đến hạn.</p>
        <p className="mt-2 text-sm text-muted-foreground">{nextDueText(hero.nextDueAt, now)}</p>
      </LeadPanel>
    );
  }
  if (hero.kind === 'done') {
    return (
      <LeadPanel aria-label="Hôm nay" tone="ok">
        <p className="text-sm font-medium text-ok">Xong hết hôm nay</p>
        <p className="mt-1 text-title">Hôm nay bạn đã ôn {hero.reviewedToday} thẻ, nghỉ thôi.</p>
        <p className="mt-2 text-sm text-muted-foreground">{nextDueText(hero.nextDueAt, now)}</p>
      </LeadPanel>
    );
  }
  const big = hero.due > 0 ? hero.due : hero.total;
  return (
    <LeadPanel aria-label="Hôm nay">
      <p className="text-sm font-medium text-accent-brand">
        {hero.due > 0 ? 'Đến hạn hôm nay' : 'Học mới hôm nay'}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-display tabular-nums">{big}</span>
        <span className="text-heading">thẻ</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{readyLine(hero)}</p>
      <ButtonLink href="/review" size="lg" className="mt-4 max-md:w-full">
        {hero.resume ? `Học tiếp, còn ${hero.total} thẻ` : 'Bắt đầu ôn'}
        <ArrowRight data-icon="inline-end" aria-hidden />
      </ButtonLink>
    </LeadPanel>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export interface RowLink {
  href: string;
  title: string;
  hint: string;
  mark?: string;
}

function Rows({ rows }: { rows: RowLink[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.href + row.title}>
          <Link
            href={row.href}
            className="flex min-h-11 items-center gap-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {row.mark && (
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-jp text-sm"
              >
                {row.mark}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{row.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NextSteps({ rows }: { rows: RowLink[] }) {
  return (
    <Panel title="Việc tiếp theo">
      <Rows rows={rows} />
    </Panel>
  );
}

export function NeedsWork({ today }: { today: Pick<Today, 'missingExamples' | 'missed'> }) {
  const rows: RowLink[] = [];
  if (today.missingExamples > 0) {
    rows.push({
      href: '/resources?card=needs-work',
      title: `${today.missingExamples} mẫu đã học có thẻ còn thiếu`,
      hint: 'Nhờ Claude bổ sung ví dụ, cách dùng, lỗi hay gặp',
    });
  }
  for (const item of today.missed) {
    rows.push({
      href: `/resources/${item.itemId}`,
      title: item.expression,
      hint: `Sai ${item.misses} lần trong 30 ngày qua`,
    });
  }
  if (rows.length === 0) return null;
  return (
    <Panel title="Cần xử lý">
      <Rows rows={rows} />
    </Panel>
  );
}

export function WeekStrip({ week, streak }: { week: WeekDay[]; streak: Today['streak'] }) {
  return (
    <Panel title="Tuần này">
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Các ngày đã học trong tuần">
        {week.map((d, i) => (
          <li key={d.day} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'h-6 w-full rounded-md',
                d.studied ? 'bg-accent-brand' : 'bg-muted',
                d.today && !d.studied && 'ring-2 ring-accent-brand ring-inset',
              )}
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">
              {WEEKDAY[i]}
              <span className="sr-only">
                {d.studied ? ': đã học' : d.future ? ': chưa tới' : ': chưa học'}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Chuỗi {streak.current} ngày, kỷ lục {streak.longest}
      </p>
    </Panel>
  );
}

export function ForecastMini({ forecast }: { forecast: Today['forecast'] }) {
  const max = Math.max(1, ...forecast.map((d) => d.count));
  const total = forecast.reduce((s, d) => s + d.count, 0);
  return (
    <Panel
      title="14 ngày tới"
      action={
        <Link href="/analytics" className="text-xs text-muted-foreground hover:underline">
          Xem phân tích
        </Link>
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có thẻ nào hẹn trong 14 ngày tới.</p>
      ) : (
        <div
          className="flex h-12 items-end gap-1"
          role="img"
          aria-label={`${total} thẻ đến hạn trong 14 ngày tới`}
        >
          {forecast.map((d) => (
            <span
              key={d.day}
              className="flex-1 rounded-t-sm bg-warn/50"
              style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
              title={`${d.day.slice(8)}/${d.day.slice(5, 7)}: ${d.count} thẻ`}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
