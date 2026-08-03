import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  GraduationCap,
  Inbox,
  Target,
} from 'lucide-react';
import { PageShell } from '@/components/shell/page-shell';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { Badge } from '@/components/ui/badge';
import { AnalyticsTabs } from '@/components/dashboard/analytics-tabs';
import { DailyProgress } from '@/components/dashboard/daily-progress';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { StatsView } from '@/components/dashboard/stats-view';
import { StreakCard } from '@/components/dashboard/streak-card';
import { ContentGapNotice } from '@/components/resources/content-gap-notice';
import { RetentionGauge } from '@/components/dashboard/retention-gauge';
import { LearnerProfile } from '@/components/dashboard/learner-profile';
import { WeakItemBadge } from '@/components/shared/weak-item-badge';
import { ERROR_TAG_LABELS } from '@/lib/error-tags';
import { getAnalytics } from '@/lib/analytics';
import { getStats, getWeakReport } from '@/lib/practice';
import { computeDossier } from '@/lib/dossier';
import { listLearnerNotesWithEvidence } from '@/lib/learner-notes';
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Pure-CSS vertical bar chart — no chart dependency, server-rendered. */
function Bars({
  data,
  barClass = 'bg-accent-brand/70',
  empty,
}: {
  data: { label: string; value: number; hint?: string }[];
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
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{d.value || ''}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={cn('w-full rounded-t', barClass)}
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              title={d.hint ?? `${d.label}: ${d.value}`}
              aria-hidden
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
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
  if (data.every((d) => d.count === 0)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hoạt động nào.</p>;
  }
  return (
    <div className="overflow-x-auto">
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
    </div>
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
  const [stats, weak, analytics, studyStats, dossier, learnerNotes] = await Promise.all([
    getStats(),
    getWeakReport(),
    getAnalytics(),
    getStudyStats(),
    // The SAME student model the tutor reads (lib/dossier.ts) — one definition, two surfaces, so the
    // dashboard can never disagree with what Claude was told about this learner.
    computeDossier(),
    listLearnerNotesWithEvidence(),
  ]);
  const totalItems = stats.totalItems;
  const hasWeakData =
    weak.tagCounts.length > 0 ||
    weak.leeches.length > 0 ||
    weak.worstItems.length > 0 ||
    analytics.watchlist.length > 0;
  const masteredPct =
    totalItems > 0 ? Math.round((analytics.masteredGrammar / totalItems) * 100) : 0;

  const forecastData = analytics.forecast14.map((f) => ({
    label: f.day.slice(5).replace('-', '/'),
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
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

      <section>
        <ChartCard title="Hoạt động 1 năm (lượt ôn mỗi ngày)" action={<HeatmapLegend />}>
          <Heatmap data={analytics.activity} max={analytics.activityMax} />
        </ChartCard>
      </section>

      <section>
        <ChartCard title="Dự báo đến hạn 14 ngày tới">
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
        <ChartCard title="Trí nhớ thực tế so với mục tiêu">
          <RetentionGauge
            actual={analytics.trueRetention}
            desired={analytics.desiredRetention}
            windowDays={analytics.retentionWindowDays}
          />
        </ChartCard>
      </section>

      {hasWeakData && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Target className="size-4" aria-hidden /> Điểm yếu 30 ngày
          </h2>
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
        </section>
      )}

      <LearnerProfile
        dossier={dossier}
        notes={learnerNotes}
        voiceSpeaker={stats.settings.voiceSpeaker}
        speechRate={stats.settings.speechRate}
        furiganaMode={stats.settings.furiganaMode}
      />

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
