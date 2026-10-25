import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { AnalyticsTabs } from '@/components/features/dashboard/analytics-tabs';
import { DailyProgress } from '@/components/features/dashboard/daily-progress';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { StatsView } from '@/components/features/dashboard/stats-view';
import { StreakCard } from '@/components/features/dashboard/streak-card';
import { LibraryTile } from '@/components/features/dashboard/library-tile';
import {
  WeakChips,
  type WeakChip,
  type WeakKind,
} from '@/components/features/dashboard/weak-chips';
import { ContentGapChip } from '@/components/features/resources/content-gap-notice';
import { RetentionCard } from '@/components/features/dashboard/retention-gauge';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { getDashboard } from '@/lib/insights/dashboard';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: 'Phân tích — sakubun',
  description: 'Tiến độ ôn tập và điểm yếu của bạn.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await getSessionUserId();
  const data = await getDashboard();
  const { weak } = data;
  const totalItems = data.grammarTotal;
  const hasWeakData =
    weak.tagCounts.length > 0 ||
    weak.leeches.length > 0 ||
    weak.worstItems.length > 0 ||
    weak.watchlist.length > 0;
  const masteredPct = totalItems > 0 ? Math.round((data.masteredGrammar / totalItems) * 100) : 0;

  const forecastData = data.forecast14.map((f) => ({
    label: f.day.slice(5).replace('-', '/'),
    short: f.day.slice(8),
    value: f.count,
  }));

  if (totalItems === 0) {
    return (
      <PageShell template="dashboard" title="Phân tích">
        <LiveRefresh />
        <EmptyState
          icon={Inbox}
          title="Chưa có gì để học"
          description="Thêm mẫu ngữ pháp vào Tài nguyên, rồi số liệu sẽ hiện ở đây."
          action={
            <Button asChild variant="outline">
              <Link href="/resources">
                Mở Tài nguyên <ArrowRight aria-hidden />
              </Link>
            </Button>
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
        n: t.count,
        title: `${ERROR_TAG_LABELS[t.tag]}: ${t.count} lần`,
      })),
    },
    {
      kind: 'misses',
      chips: weak.worstItems.map((w) => ({
        key: w.itemId,
        text: w.expression,
        count: `×${w.misses}`,
        n: w.misses,
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
        n: l.lapses,
        title: `Quên ${l.lapses} lần${l.suspendSuggested ? ' · nên tạm ngưng' : ''}`,
        href: `/resources/${l.itemId}`,
      })),
    },
    {
      kind: 'hard',
      chips: weak.watchlist.map((w) => ({
        key: w.itemId,
        text: w.expression,
        count: w.difficulty.toFixed(1),
        n: w.difficulty,
        title: `Độ khó ${w.difficulty.toFixed(1)}/10`,
        href: `/resources/${w.itemId}`,
      })),
    },
  ];

  const progress = (
    <>
      <section aria-label="Tổng quan" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={CalendarClock}
          tone="brand"
          items={[{ value: data.dueNow, label: 'Đến hạn' }]}
          note={`Còn ${data.newItems} mẫu mới`}
          explain={`Số lượt ôn đến hạn bây giờ. Còn ${data.newItems} mẫu chưa học lần nào.`}
        />
        <StreakCard
          current={data.streak.current}
          note={`Kỷ lục ${data.streak.longest} ngày`}
          explain={`Số ngày học liên tiếp. Kỷ lục ${data.streak.longest} ngày; 30 ngày qua ${data.reviewsLast30} lượt ôn.`}
        />
        <StatTile
          icon={GraduationCap}
          tone="ok"
          items={[{ value: `${masteredPct}%`, label: 'Thành thạo' }]}
          note={`${data.masteredGrammar}/${totalItems} mẫu`}
          explain={`${data.masteredGrammar}/${totalItems} mẫu đang ở trạng thái Ôn tập.`}
        />
        <LibraryTile
          grammar={totalItems}
          vocab={data.vocabTotal}
          explain={`Kho học của bạn: ${totalItems} ngữ pháp, ${data.vocabTotal} từ vựng; ${data.newLast30} mục mới trong 30 ngày qua.`}
        />
      </section>

      <DailyProgress
        daily={data.study.daily}
        sessionGoal={data.settings.sessionGoal}
        dailyNewGrammar={data.settings.dailyNewGrammar}
        dueNow={data.dueNow}
      />

      <section className="grid gap-3 lg:grid-cols-2">
        <RetentionCard
          actual={data.retention.actual}
          desired={data.retention.desired}
          windowDays={data.retention.windowDays}
        />
        <ChartCard
          icon={CalendarRange}
          title="14 ngày tới"
          info="Số mẫu đến hạn ôn mỗi ngày trong 14 ngày tới; số trên cột là số mẫu, dưới cột là ngày."
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
          <LevelBars data={data.levelDist} totals={data.mastery} />
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
        <Heatmap data={data.activity} max={data.activityMax} />
      </ChartCard>
    </>
  );

  return (
    <>
      <LiveRefresh />
      <AnalyticsTabs
        progress={progress}
        stats={<StatsView stats={data.study} />}
        aside={
          data.content.studiedWithoutCard > 0 ? (
            <ContentGapChip
              studiedWithoutCard={data.content.studiedWithoutCard}
              enriched={data.content.enrichedGrammar}
              total={data.grammarTotal}
            />
          ) : undefined
        }
      />
    </>
  );
}
