import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  Brain,
  CalendarCheck,
  CalendarClock,
  GraduationCap,
  Inbox,
  Target,
} from 'lucide-react';
import { PageShell } from '@/components/shell/page-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { ScrollEndOnMount } from '@/components/shared/scroll-end-on-mount';
import { Badge } from '@/components/ui/badge';
import { AnalyticsTabs } from '@/components/dashboard/analytics-tabs';
import { DailyProgress } from '@/components/dashboard/daily-progress';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { StatsView } from '@/components/dashboard/stats-view';
import { StreakCard } from '@/components/dashboard/streak-card';
import { LastGradedCard } from '@/components/dashboard/last-graded-card';
import { ContentGapNotice } from '@/components/resources/content-gap-notice';
import { RetentionGauge } from '@/components/dashboard/retention-gauge';
import { LearnerProfile } from '@/components/dashboard/learner-profile';
import { WeakItemBadge } from '@/components/shared/weak-item-badge';
import { ERROR_TAG_LABELS } from '@/lib/error-tags';
import { getAnalytics } from '@/lib/analytics';
import { getSettings, getStats, getWeakReport, listSentences } from '@/lib/practice';
import { computeDossier } from '@/lib/dossier';
import { listLearnerNotesWithEvidence } from '@/lib/learner-notes';
import { chartEmptyMessage } from '@/lib/chart-empty';
import { getStudyStats } from '@/lib/stats';
import { getSessionUserId } from '@/lib/current-user';
import { cn } from '@/lib/utils';

/**
 * Metadata for "/" — the analytics dashboard. No marketing/OG card: this is a private single-user
 * app behind /login, so there is no public link for a stranger to be handed.
 */
export const metadata: Metadata = {
  title: 'Phân tích — sakubun',
  description: 'Tiến độ ôn tập, điểm yếu và hồ sơ học của bạn.',
};

export const dynamic = 'force-dynamic';

/**
 * The page's ONE structural device (issue #38).
 *
 * Measured 2026-08-13 at 390px: ten blocks, 2495px tall, and a single divider — so the page read as one
 * flat list three screens long and there was no way to tell which part you were in. The order of those
 * blocks followed the DATA SOURCES (`getStats` → `getAnalytics` → `getWeakReport` → `computeDossier`),
 * not the questions a learner arrives with, which is why "how is my memory holding up" was answered by
 * a KPI at the top and by three charts a screen and a half below it.
 *
 * Three groups, each named after its question. The subtitle is load-bearing, not decoration: it is what
 * makes the group a claim you can disagree with rather than a label.
 */
function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Inbox;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * `bg-card` is the change that makes the page read as cards at all: the page background is the ivory
 * `--background`, and these tiles used to be transparent — so a "card" was a hairline rectangle of the
 * same colour as the page. `--card` on `--background` is the treatment the rest of the app already uses
 * (`SettingsTab` wraps its body in `Card`), so this aligns the dashboard with it rather than inventing.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  hero = false,
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  hint?: string;
  /** The one KPI that answers "what do I do right now" — bigger numeral + a brand wash behind it. */
  hero?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/70 bg-card p-4',
        hero && 'border-accent-brand/30',
      )}
    >
      {hero && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-brand/10 to-transparent"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </div>
        {/* text-xl below sm: in the two-column phone layout a 24px "50 ngữ pháp" wraps to two lines and
            makes one card taller than its neighbour; 20px keeps every value on one line. */}
        <div
          className={cn(
            'mt-2 font-semibold',
            hero ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    // `h-full` so a card in a bento row stretches to its tallest sibling instead of leaving a ragged
    // bottom edge — the whole point of putting two unequal charts on one row.
    <div
      className={cn('h-full space-y-4 rounded-xl border border-border/70 bg-card p-4', className)}
    >
      {/* flex-wrap: a long Vietnamese title + a legend cannot share 358px. Wrapping drops the legend
          onto its own line on a phone instead of squeezing the title into two ragged lines beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/* h3, not h2: the group header above it is the h2 now, so this keeps the outline honest. */}
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Pure-CSS vertical bar chart — no chart dependency, server-rendered.
 *
 * The axis labels are the whole sizing problem here: a label like "08/14" has no break opportunity, so
 * it sets a min-content width on its column that `flex-1` cannot shrink past, and 14 of them force the
 * page wider than a phone. Two guards: callers pass a `short` label used below `md`, and each column is
 * `min-w-0` + `truncate` so ANY future label degrades to an ellipsis instead of breaking the layout.
 */
function Bars({
  data,
  barClass = 'bg-accent-brand/70',
  empty,
}: {
  data: { label: string; short?: string; value: number; hint?: string }[];
  barClass?: string;
  empty: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{d.value || ''}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={cn('w-full rounded-t', barClass)}
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              title={d.hint ?? `${d.label}: ${d.value}`}
              aria-hidden
            />
          </div>
          <span className="max-w-full truncate text-[10px] text-muted-foreground">
            {d.short ? (
              <>
                <span className="md:hidden">{d.short}</span>
                <span className="max-md:hidden">{d.label}</span>
              </>
            ) : (
              d.label
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * One labelled row of weakness badges. The section used to stack unlabelled badge rows, which was
 * readable at two lists and ambiguous at four — the label says which question each row answers.
 */
function WeakList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** The "ít … nhiều" scale — rendered inline in the card's title row (as ChartCard `action`). */
function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      ít
      <span className="size-3 rounded-[3px] bg-muted" />
      <span className="size-3 rounded-[3px] bg-accent-brand/40" />
      <span className="size-3 rounded-[3px] bg-accent-brand/70" />
      <span className="size-3 rounded-[3px] bg-accent-brand" />
      nhiều
    </div>
  );
}

/** GitHub-style contribution heatmap: 7 rows (day of week) × 52 columns (weeks), color = review count. */
function Heatmap({ data, max }: { data: { day: string; count: number }[]; max: number }) {
  const empty = chartEmptyMessage({
    // Nhiệt đồ luôn là 1 năm, nên không có kỳ nào dài hơn để gợi ý — hai cờ bằng nhau.
    hasInWindow: data.some((d) => d.count > 0),
    hasInYear: data.some((d) => d.count > 0),
    rangeLabel: '1 năm',
    noun: 'hoạt động nào',
  });
  if (empty) {
    // Cùng một giọng với các thẻ ở tab Thống kê: nói luôn dữ liệu đến từ đâu, vì không nút nào trên web
    // sinh ra nó. Trước đây câu ở đây chỉ là "Chưa có hoạt động nào." — đúng mà không giúp được gì.
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    // Starts at the right end (= today). The full year is ~830px wide, so on a phone the box shows about
    // the last five months and older weeks are one swipe away — the title still honestly says "1 năm".
    <ScrollEndOnMount>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {data.map((d) => {
          const ratio = d.count / max;
          return (
            <div
              key={d.day}
              className={cn('size-3 rounded-[3px]', d.count === 0 ? 'bg-muted' : 'bg-accent-brand')}
              style={d.count === 0 ? undefined : { opacity: 0.3 + 0.7 * ratio }}
              title={`${d.day}: ${d.count} lượt`}
              aria-hidden
            />
          );
        })}
      </div>
    </ScrollEndOnMount>
  );
}

const STATE_SEGMENTS = [
  { key: 'new', label: 'Mới', bar: 'bg-muted-foreground/30' },
  { key: 'learning', label: 'Đang học', bar: 'bg-warn/70' },
  { key: 'review', label: 'Ôn tập', bar: 'bg-ok/70' },
  { key: 'relearning', label: 'Học lại', bar: 'bg-alert/70' },
  { key: 'suspended', label: 'Tạm ngưng', bar: 'bg-muted-foreground/50' },
] as const;

function StateLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {STATE_SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', s.bar)} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MasteryBar({ mastery }: { mastery: Record<string, number> }) {
  const total = STATE_SEGMENTS.reduce((sum, s) => sum + (mastery[s.key] ?? 0), 0);
  if (total === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Kho chưa có mẫu nào.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {STATE_SEGMENTS.map((s) => {
          const v = mastery[s.key] ?? 0;
          if (v === 0) return null;
          return (
            <div
              key={s.key}
              className={s.bar}
              style={{ width: `${(v / total) * 100}%` }}
              title={`${s.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STATE_SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', s.bar)} aria-hidden />
            {s.label}
            <span className="font-medium text-foreground">{mastery[s.key] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Per-JLPT-level stacked bar of FSRS states — where the learner stands at each level. */
function LevelBars({
  data,
}: {
  data: {
    level: string;
    new: number;
    learning: number;
    review: number;
    relearning: number;
    suspended: number;
    total: number;
  }[];
}) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Kho chưa có mẫu nào.</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.level} className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-xs font-medium tabular-nums">{d.level}</span>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
            {STATE_SEGMENTS.map((s) => {
              const v = d[s.key];
              if (v === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.bar}
                  style={{ width: `${(v / d.total) * 100}%` }}
                  title={`${d.level} · ${s.label}: ${v}`}
                />
              );
            })}
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {d.total}
          </span>
        </div>
      ))}
      <StateLegend />
    </div>
  );
}

export default async function HomePage() {
  // Private app, single user: "/" IS the analytics dashboard. No public landing — a guest is
  // bounced to /login by getSessionUserId() rather than shown marketing copy.
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const [stats, weak, analytics, studyStats, dossier, learnerNotes, lastGraded, settings] =
    await Promise.all([
      getStats(),
      getWeakReport(),
      getAnalytics(),
      getStudyStats(),
      // The SAME student model the tutor reads (lib/dossier.ts) — one definition, two surfaces, so the
      // dashboard can never disagree with what Claude was told about this learner.
      computeDossier(),
      listLearnerNotesWithEvidence(),
      // The turn that was just graded. See LastGradedCard: the score reaches the learner by two
      // routes and only this one is the app's to guarantee.
      listSentences(1, 'GRADED'),
      getSettings(),
    ]);
  const totalItems = stats.totalItems;
  const hasWeakData =
    weak.tagCounts.length > 0 ||
    weak.leeches.length > 0 ||
    weak.worstItems.length > 0 ||
    analytics.watchlist.length > 0;
  const masteredPct =
    totalItems > 0 ? Math.round((analytics.masteredGrammar / totalItems) * 100) : 0;

  // `short` is the day of month alone. 14 columns of "08/14" need ~29px each of unbreakable text, which
  // is 484px of min-content — 126px more than a 390px phone has, and THAT is what pushed the whole
  // dashboard sideways (every card then sat in a 526px-wide page). The card title already says which
  // 14 days these are, so the month is redundant on the axis. See Bars.
  const forecastData = analytics.forecast14.map((f) => ({
    label: f.day.slice(5).replace('-', '/'),
    short: f.day.slice(8),
    value: f.count,
  }));

  if (totalItems === 0) {
    return (
      <PageShell section="dashboard">
        <LiveRefresh />
        <EmptyState
          icon={Inbox}
          title="Chưa có gì để học"
          description="Bắt đầu bằng cách nhập mẫu ngữ pháp vào kho."
          action={
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/resources"
                className="inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
              >
                Mở kho tài nguyên <ArrowRight className="size-4" aria-hidden />
              </Link>
              {/* A brand-new account lands here: the 7-step tutorial is the honest next click. */}
              <GuideLink tab="start" label="Hướng dẫn bắt đầu (7 bước)" />
            </div>
          }
        />
      </PageShell>
    );
  }

  const progress = (
    <>
      {/* ── HÔM NAY — the daily loop ─────────────────────────────────────────────────────────────
          Measured before the regroup: "Đến hạn bây giờ" sat at 72px and "Tiến độ hôm nay" ended at
          852px, so this group already fitted one screen and its ORDER was already right. What it
          lacked was a name. Nothing is reordered inside it. */}
      <SectionHeader
        icon={CalendarCheck}
        title="Hôm nay"
        hint="Việc đang chờ, và kết quả của lượt vừa chấm."
      />

      {/* The score of the turn just finished, FIRST — it is the answer to the question the learner
          arrives with. Absent only before the first graded turn. */}
      {lastGraded[0] && (
        <LastGradedCard
          sentence={lastGraded[0]}
          voiceSpeaker={settings.voiceSpeaker}
          speechRate={settings.speechRate}
          furiganaMode={settings.furiganaMode}
        />
      )}

      {/* Two columns from the smallest screen up (was one below sm): four stacked cards ate 310px, so a
          phone opened the dashboard on two KPIs and had to scroll for the other two. Paired up they all
          land above the fold, which is the entire job of this row. gap-3 below sm to buy label width. */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          hero
          icon={CalendarClock}
          label="Đến hạn bây giờ"
          value={String(stats.dueNow)}
          hint={`${stats.newItems} mẫu chưa học lần nào`}
        />
        <StreakCard
          current={stats.streak.current}
          hint={`kỷ lục ${stats.streak.longest} · 30 ngày qua ${analytics.reviewsLast30} lượt`}
        />
        <StatCard
          icon={GraduationCap}
          label="Đã thành thạo"
          value={`${masteredPct}%`}
          hint={`${analytics.masteredGrammar}/${totalItems} mẫu ở trạng thái Ôn tập`}
        />
        <StatCard
          icon={BookOpenText}
          label="Kho học"
          value={`${totalItems} ngữ pháp`}
          hint={`${analytics.vocabTotal} từ vựng · ${analytics.newLast30} mục mới 30 ngày`}
        />
      </section>

      <section>
        <ContentGapNotice
          studiedWithoutCard={analytics.studiedWithoutCard}
          enriched={analytics.enrichedGrammar}
          total={analytics.grammarTotal}
        />
      </section>

      <section>
        <DailyProgress
          daily={studyStats.daily}
          sessionGoal={stats.settings.sessionGoal}
          dailyNewGrammar={stats.settings.dailyNewGrammar}
          dueNow={stats.dueNow}
        />
      </section>

      {/* ── TRÍ NHỚ — is the schedule keeping up with the actual memory ───────────────────────────
          The verdict card comes FIRST here and is deliberately the narrow column: it is the only block
          on the page that says whether the numbers are good or bad, and it was previously the LAST of
          the four memory blocks, a screen below the KPI that raises the same question. */}
      <SectionHeader
        icon={Brain}
        title="Trí nhớ"
        hint="Lịch ôn có bám kịp trí nhớ thật của bạn không, và kho đang đứng ở đâu."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Trí nhớ thực tế so với mục tiêu">
          <RetentionGauge
            actual={analytics.trueRetention}
            desired={analytics.desiredRetention}
            windowDays={analytics.retentionWindowDays}
          />
        </ChartCard>
        <ChartCard title="Dự báo đến hạn 14 ngày tới" className="lg:col-span-2">
          <Bars
            data={forecastData}
            barClass="bg-warn/70"
            empty="Không có mẫu nào đến hạn trong 14 ngày tới."
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Phân bố ngữ pháp theo cấp JLPT">
          <LevelBars data={analytics.levelDist} />
        </ChartCard>
        <ChartCard title="Toàn kho theo trạng thái ghi nhớ">
          <MasteryBar mastery={stats.mastery} />
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Hoạt động 1 năm (lượt ôn mỗi ngày)" action={<HeatmapLegend />}>
          <Heatmap data={analytics.activity} max={analytics.activityMax} />
        </ChartCard>
      </section>

      {/* ── ĐIỂM YẾU — what to fix next ──────────────────────────────────────────────────────────
          The header renders with `hasWeakData` only, which is what the old bare `<h2>` did too. When
          there is no weakness data but the learner model is non-empty, `LearnerProfile` still renders
          below on its own — unchanged behaviour, and better than duplicating its emptiness rule here
          (it is derived inside the component from four sources; a copy would drift). */}
      {hasWeakData && (
        <>
          <SectionHeader
            icon={Target}
            title="Điểm yếu"
            hint="30 ngày qua: lỗi hay mắc, mẫu sai nhiều, và những gì Claude đã ghi lại về bạn."
          />
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="h-full space-y-4 rounded-xl border border-border/70 bg-card p-4">
              {weak.tagCounts.length > 0 && (
                <WeakList label="Loại lỗi hay mắc">
                  {weak.tagCounts.map((t) => (
                    <Badge key={t.tag} variant="outline" className="border-warn/40 text-warn">
                      {ERROR_TAG_LABELS[t.tag]} ×{t.count}
                    </Badge>
                  ))}
                </WeakList>
              )}
              {weak.worstItems.length > 0 && (
                <WeakList label="Sai nhiều nhất">
                  {weak.worstItems.map((w) => (
                    <WeakItemBadge
                      key={w.itemId}
                      itemId={w.itemId}
                      expression={w.expression}
                      detail={`sai ×${w.misses}${w.tags.length ? ` · ${w.tags.map((t) => ERROR_TAG_LABELS[t]).join(', ')}` : ''}`}
                    />
                  ))}
                </WeakList>
              )}
              {weak.leeches.length > 0 && (
                <WeakList label="Quên đi quên lại">
                  {weak.leeches.map((l) => (
                    <WeakItemBadge
                      key={l.itemId}
                      itemId={l.itemId}
                      expression={l.expression}
                      tone="alert"
                      detail={`quên ×${l.lapses}${l.suspendSuggested ? ' · nên tạm ngưng' : ''}`}
                    />
                  ))}
                </WeakList>
              )}
              {analytics.watchlist.length > 0 && (
                <WeakList label="Tốn sức nhớ nhất">
                  {analytics.watchlist.map((w) => (
                    <WeakItemBadge
                      key={w.itemId}
                      itemId={w.itemId}
                      expression={w.expression}
                      detail={`độ khó ${w.difficulty.toFixed(1)}/10`}
                    />
                  ))}
                </WeakList>
              )}
            </div>

            <div className="h-full rounded-xl border border-border/70 bg-card p-4">
              <LearnerProfile
                dossier={dossier}
                notes={learnerNotes}
                voiceSpeaker={stats.settings.voiceSpeaker}
                speechRate={stats.settings.speechRate}
                furiganaMode={stats.settings.furiganaMode}
              />
            </div>
          </section>
        </>
      )}

      {!hasWeakData && (
        <LearnerProfile
          dossier={dossier}
          notes={learnerNotes}
          voiceSpeaker={stats.settings.voiceSpeaker}
          speechRate={stats.settings.speechRate}
          furiganaMode={stats.settings.furiganaMode}
        />
      )}

      <section className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
        >
          Xem lịch sử dịch <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
        >
          Quản lý kho tài nguyên <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </>
  );

  return (
    <>
      <LiveRefresh />
      <AnalyticsTabs progress={progress} stats={<StatsView stats={studyStats} />} />
    </>
  );
}
