import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpenText,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  Inbox,
  Layers,
  Target,
} from 'lucide-react';
import {
  Bars,
  ChartCard,
  Heatmap,
  HeatmapLegend,
  LevelBars,
  StatTile,
} from '@/components/features/dashboard/dashboard-charts';
import { PageShell } from '@/components/layout/page-shell';
import { EmptyState } from '@/components/common/empty-state';
import { AnalyticsTabs } from '@/components/features/dashboard/analytics-tabs';
import { DailyProgress } from '@/components/features/dashboard/daily-progress';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { StatsView } from '@/components/features/dashboard/stats-view';
import { StreakCard } from '@/components/features/dashboard/streak-card';
import {
  WeakChips,
  type WeakChip,
  type WeakKind,
} from '@/components/features/dashboard/weak-chips';
import { ContentGapChip } from '@/components/features/resources/content-gap-notice';
import { RetentionCard } from '@/components/features/dashboard/retention-gauge';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { getAnalytics } from '@/lib/insights/analytics';
import { getStats, getWeakReport } from '@/lib/library/practice';
import { getStudyStats } from '@/lib/insights/stats';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: 'Phân tích — sakubun',
  description: 'Tiến độ ôn tập và điểm yếu của bạn.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await getSessionUserId();
  const [stats, weak, analytics, studyStats] = await Promise.all([
    getStats(),
    getWeakReport(),
    getAnalytics(),
    getStudyStats(),
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

  const weakGroups: { kind: WeakKind; chips: WeakChip[] }[] = [
    {
      kind: 'tags',
      chips: weak.tagCounts.map((t) => ({
        key: t.tag,
        text: ERROR_TAG_LABELS[t.tag],
        count: `×${t.count}`,
        title: `${ERROR_TAG_LABELS[t.tag]}: ${t.count} lần`,
      })),
    },
    {
      kind: 'misses',
      chips: weak.worstItems.map((w) => ({
        key: w.itemId,
        text: w.expression,
        count: `×${w.misses}`,
        title: `Sai ${w.misses} lần${w.tags.length ? ` · ${w.tags.map((t) => ERROR_TAG_LABELS[t]).join(', ')}` : ''}`,
        href: `/resources/${w.itemId}`,
      })),
    },
    {
      kind: 'lapses',
      chips: weak.leeches.map((l) => ({
        key: l.itemId,
        text: l.expression,
        count: `×${l.lapses}`,
        title: `Quên ${l.lapses} lần${l.suspendSuggested ? ' · nên tạm ngưng' : ''}`,
        href: `/resources/${l.itemId}`,
      })),
    },
    {
      kind: 'hard',
      chips: analytics.watchlist.map((w) => ({
        key: w.itemId,
        text: w.expression,
        count: w.difficulty.toFixed(1),
        title: `Độ khó ${w.difficulty.toFixed(1)}/10`,
        href: `/resources/${w.itemId}`,
      })),
    },
  ];

  const progress = (
    <>
      <section aria-label="Tổng quan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CalendarClock}
          tone="brand"
          items={[{ value: stats.dueNow, label: 'Đến hạn' }]}
          explain={`Số lượt ôn đến hạn bây giờ. Còn ${stats.newItems} mẫu chưa học lần nào.`}
        />
        <StreakCard
          current={stats.streak.current}
          explain={`Số ngày học liên tiếp. Kỷ lục ${stats.streak.longest} ngày; 30 ngày qua ${analytics.reviewsLast30} lượt ôn.`}
        />
        <StatTile
          icon={GraduationCap}
          tone="ok"
          items={[{ value: `${masteredPct}%`, label: 'Thành thạo' }]}
          explain={`${analytics.masteredGrammar}/${totalItems} mẫu đang ở trạng thái Ôn tập.`}
        />
        <StatTile
          icon={BookOpenText}
          tone="info"
          items={[
            { value: totalItems, label: 'Ngữ pháp' },
            { value: analytics.vocabTotal, label: 'Từ vựng' },
          ]}
          compact={{ value: totalItems + analytics.vocabTotal, label: 'Mục' }}
          explain={`Kho học của bạn: ${totalItems} ngữ pháp, ${analytics.vocabTotal} từ vựng; ${analytics.newLast30} mục mới trong 30 ngày qua.`}
        />
      </section>

      <DailyProgress
        daily={studyStats.daily}
        sessionGoal={stats.settings.sessionGoal}
        dailyNewGrammar={stats.settings.dailyNewGrammar}
        dueNow={stats.dueNow}
      />

      <section className="grid gap-3 lg:grid-cols-3">
        <RetentionCard
          actual={analytics.trueRetention}
          desired={analytics.desiredRetention}
          windowDays={analytics.retentionWindowDays}
        />
        <ChartCard
          icon={CalendarRange}
          title="14 ngày tới"
          info="Số mẫu đến hạn ôn mỗi ngày trong 14 ngày tới; số trên cột là số mẫu, dưới cột là ngày."
          className="lg:col-span-2"
        >
          <Bars
            data={forecastData}
            barClass="bg-warn/70"
            empty="Không có mẫu nào đến hạn trong 14 ngày tới."
          />
        </ChartCard>
      </section>

      <section className={hasWeakData ? 'grid gap-3 lg:grid-cols-2' : undefined}>
        <ChartCard
          icon={Layers}
          title="Theo cấp"
          info="Ngữ pháp theo cấp JLPT, chia theo trạng thái ghi nhớ. Số cạnh chú thích là tổng toàn kho."
        >
          <LevelBars data={analytics.levelDist} totals={stats.mastery} />
        </ChartCard>
        {hasWeakData && (
          <ChartCard
            icon={Target}
            title="Điểm yếu"
            info="30 ngày qua: loại lỗi hay mắc, mẫu sai nhiều, mẫu quên đi quên lại và mẫu tốn sức nhớ nhất. Bấm một mẫu để mở nó."
          >
            <WeakChips groups={weakGroups} />
          </ChartCard>
        )}
      </section>

      <ChartCard
        icon={Activity}
        title="1 năm"
        info="Số lượt ôn mỗi ngày trong một năm qua."
        action={<HeatmapLegend />}
      >
        <Heatmap data={analytics.activity} max={analytics.activityMax} />
      </ChartCard>
    </>
  );

  return (
    <>
      <LiveRefresh />
      <AnalyticsTabs
        progress={progress}
        stats={<StatsView stats={studyStats} />}
        aside={
          <ContentGapChip
            studiedWithoutCard={analytics.studiedWithoutCard}
            enriched={analytics.enrichedGrammar}
            total={analytics.grammarTotal}
          />
        }
      />
    </>
  );
}
