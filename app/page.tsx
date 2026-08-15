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
import { SectionHeading } from '@/components/common/section-heading';
import {
  Bars,
  ChartCard,
  Heatmap,
  HeatmapLegend,
  LevelBars,
  MasteryBar,
  StatCard,
  WeakList,
} from '@/components/features/dashboard/dashboard-charts';
import { PageShell } from '@/components/layout/page-shell';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { AnalyticsTabs } from '@/components/features/dashboard/analytics-tabs';
import { DailyProgress } from '@/components/features/dashboard/daily-progress';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { StatsView } from '@/components/features/dashboard/stats-view';
import { StreakCard } from '@/components/features/dashboard/streak-card';
import { ContentGapNotice } from '@/components/features/resources/content-gap-notice';
import { RetentionGauge } from '@/components/features/dashboard/retention-gauge';
import { LearnerProfile } from '@/components/features/dashboard/learner-profile';
import { WeakItemBadge } from '@/components/common/weak-item-badge';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { getAnalytics } from '@/lib/insights/analytics';
import { getStats, getWeakReport } from '@/lib/library/practice';
import { computeDossier } from '@/lib/session/dossier';
import { listLearnerNotesWithEvidence } from '@/lib/session/learner-notes';
import { getStudyStats } from '@/lib/insights/stats';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: 'Phân tích — sakubun',
  description: 'Tiến độ ôn tập, điểm yếu và hồ sơ học của bạn.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await getSessionUserId();
  const [stats, weak, analytics, studyStats, dossier, learnerNotes] = await Promise.all([
    getStats(),
    getWeakReport(),
    getAnalytics(),
    getStudyStats(),
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
            <Link
              href="/resources"
              className="inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
            >
              Mở kho tài nguyên <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        />
      </PageShell>
    );
  }

  const progress = (
    <>
      <SectionHeading
        level="page"
        icon={CalendarCheck}
        title="Hôm nay"
        hint="Việc đang chờ, và kết quả của lượt vừa chấm."
      />

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

      <SectionHeading
        level="page"
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

      {hasWeakData && (
        <>
          <SectionHeading
            level="page"
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
